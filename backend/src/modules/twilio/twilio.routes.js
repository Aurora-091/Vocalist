const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { BadRequest, NotFound, Conflict } = require("../../utils/errors");
const { toE164 } = require("../../utils/phone");
const env = require("../../config/env");
const { isSandbox, getOrCreateSubaccount, getTenantClient } = require("./twilio.client");

const router = express.Router();
router.use(requireAuth, requireOrg);

const SEARCH_TTL_MS = 10 * 60_000;

router.get(
  "/subaccount",
  asyncHandler(async (req, res) => {
    const { data } = await req.supabase
      .from("twilio_subaccounts")
      .select("subaccount_sid, status, region, last_synced_at, error_count, created_at")
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    res.json({
      sandbox: isSandbox(),
      subaccount: data || null,
    });
  })
);

router.post(
  "/subaccount",
  requireRole("owner", "admin"),
  asyncHandler(async (req, res) => {
    const { data: org } = await req.supabase
      .from("orgs")
      .select("name")
      .eq("id", req.auth.orgId)
      .maybeSingle();

    const sub = await getOrCreateSubaccount(req.auth.orgId, org?.name || null);
    res.status(201).json({
      sandbox: isSandbox(),
      subaccount: {
        subaccount_sid: sub.subaccount_sid,
        status: sub.status,
        region: sub.region,
      },
    });
  })
);

const searchSchema = z.object({
  country: z.string().length(2).default("US"),
  area_code: z.string().regex(/^\d{3}$/).optional(),
  kind: z.enum(["local", "tollfree"]).default("local"),
});

router.get(
  "/numbers/search",
  validate({ query: searchSchema }),
  asyncHandler(async (req, res) => {
    const { country, area_code: areaCode, kind } = req.query;

    const { data: cached } = await req.supabase
      .from("phone_number_search_cache")
      .select("results, expires_at")
      .eq("org_id", req.auth.orgId)
      .eq("country", country)
      .eq("kind", kind)
      .eq("area_code", areaCode || "")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return res.json({ results: cached.results, cached: true });
    }

    await getOrCreateSubaccount(req.auth.orgId);
    const client = await getTenantClient(req.auth.orgId);
    const opts = { limit: 10 };
    if (areaCode) opts.areaCode = areaCode;

    const list =
      kind === "tollfree"
        ? await client.availablePhoneNumbers(country).tollFree.list(opts)
        : await client.availablePhoneNumbers(country).local.list(opts);

    const results = list.map((n) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality,
      region: n.region,
      isoCountry: n.isoCountry,
      capabilities: n.capabilities || {},
      monthlyCostUsd: kind === "tollfree" ? 2.0 : 1.15,
    }));

    await req.supabase.from("phone_number_search_cache").insert({
      org_id: req.auth.orgId,
      country,
      area_code: areaCode || "",
      kind,
      results,
      expires_at: new Date(Date.now() + SEARCH_TTL_MS).toISOString(),
    });

    res.json({ results, cached: false });
  })
);

const purchaseSchema = z.object({
  phone_number: z.string().min(8),
  agent_id: z.string().uuid().optional(),
});

router.post(
  "/numbers/purchase",
  requireRole("owner", "admin"),
  validate({ body: purchaseSchema }),
  asyncHandler(async (req, res) => {
    const e164 = toE164(req.body.phone_number, "US");
    if (!e164) throw BadRequest("invalid phone number");

    const { data: dup } = await req.supabase
      .from("phone_numbers")
      .select("id")
      .eq("org_id", req.auth.orgId)
      .eq("e164", e164)
      .maybeSingle();
    if (dup) throw Conflict("number already in your account");

    if (req.body.agent_id) {
      const { data: agent } = await req.supabase
        .from("agents")
        .select("id")
        .eq("id", req.body.agent_id)
        .eq("org_id", req.auth.orgId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!agent) throw NotFound("agent not found");
    }

    await getOrCreateSubaccount(req.auth.orgId);
    const client = await getTenantClient(req.auth.orgId);

    const voiceUrl = env.TWILIO_VOICE_BASE_URL
      ? `${env.TWILIO_VOICE_BASE_URL}/webhooks/twilio/voice`
      : null;
    const statusCallback = env.TWILIO_VOICE_BASE_URL
      ? `${env.TWILIO_VOICE_BASE_URL}/webhooks/twilio`
      : null;

    let twilioRow;
    try {
      twilioRow = await client.incomingPhoneNumbers.create({
        phoneNumber: e164,
        voiceUrl: voiceUrl || undefined,
        statusCallback: statusCallback || undefined,
      });
    } catch (e) {
      throw BadRequest(e.message || "Twilio purchase failed");
    }

    const { data: row, error } = await req.supabase
      .from("phone_numbers")
      .insert({
        org_id: req.auth.orgId,
        e164,
        owner: "aurora",
        byo: false,
        agent_id: req.body.agent_id || null,
        provider: "twilio",
        provider_ref: twilioRow.sid,
        voice_url: voiceUrl,
        status_callback_url: statusCallback,
        capabilities: twilioRow.capabilities || {},
        purchased_at: new Date().toISOString(),
        monthly_cost_usd: isSandbox() ? 0 : null,
        status: isSandbox() ? "sandbox" : "active",
        subaccount_org_id: req.auth.orgId,
      })
      .select("*")
      .maybeSingle();
    if (error) throw error;

    if (req.body.agent_id && row) {
      const agentService = require("../agents/agent.service");
      await agentService.assignNumber(req.supabase, req.auth.orgId, req.body.agent_id, row.id).catch(err => {
        logger.error({ err: err.message }, "Failed to auto-assign phone number to provider agent");
      });
    }

    await req.supabase
      .from("onboarding_state")
      .update({ steps: { get_number: true }, updated_at: new Date().toISOString() })
      .eq("org_id", req.auth.orgId);

    res.status(201).json({ number: row, sandbox: isSandbox() });
  })
);

const byoSchema = z.object({
  phone_number: z.string().min(8),
  agent_id: z.string().uuid().optional(),
  twilio_sid: z.string().optional(),
});

router.post(
  "/numbers/byo",
  requireRole("owner", "admin"),
  validate({ body: byoSchema }),
  asyncHandler(async (req, res) => {
    const e164 = toE164(req.body.phone_number, "US");
    if (!e164) throw BadRequest("invalid phone number");

    const { data: dup } = await req.supabase
      .from("phone_numbers")
      .select("id")
      .eq("org_id", req.auth.orgId)
      .eq("e164", e164)
      .maybeSingle();
    if (dup) throw Conflict("number already attached");

    await getOrCreateSubaccount(req.auth.orgId);

    const voiceUrl = env.TWILIO_VOICE_BASE_URL
      ? `${env.TWILIO_VOICE_BASE_URL}/webhooks/twilio/voice`
      : null;
    const statusCallback = env.TWILIO_VOICE_BASE_URL
      ? `${env.TWILIO_VOICE_BASE_URL}/webhooks/twilio`
      : null;

    let provider_ref = req.body.twilio_sid || null;
    if (!isSandbox() && provider_ref) {
      const client = await getTenantClient(req.auth.orgId);
      try {
        await client.incomingPhoneNumbers.update(provider_ref, {
          voiceUrl,
          statusCallback,
        });
      } catch (e) {
        throw BadRequest(e.message || "Could not update Twilio number");
      }
    }

    const { data: row, error } = await req.supabase
      .from("phone_numbers")
      .insert({
        org_id: req.auth.orgId,
        e164,
        owner: "tenant",
        byo: true,
        agent_id: req.body.agent_id || null,
        provider: "twilio",
        provider_ref,
        voice_url: voiceUrl,
        status_callback_url: statusCallback,
        status: isSandbox() ? "sandbox" : "active",
        subaccount_org_id: req.auth.orgId,
      })
      .select("*")
      .maybeSingle();
    if (error) throw error;

    if (req.body.agent_id && row) {
      const agentService = require("../agents/agent.service");
      await agentService.assignNumber(req.supabase, req.auth.orgId, req.body.agent_id, row.id).catch(err => {
        logger.error({ err: err.message }, "Failed to auto-assign BYO phone number to provider agent");
      });
    }

    await req.supabase
      .from("onboarding_state")
      .update({ steps: { get_number: true }, updated_at: new Date().toISOString() })
      .eq("org_id", req.auth.orgId);

    res.status(201).json({ number: row, sandbox: isSandbox() });
  })
);

router.delete(
  "/numbers/:id",
  requireRole("owner", "admin"),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { data: row } = await req.supabase
      .from("phone_numbers")
      .select("id, owner, provider_ref")
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (!row) throw NotFound("number not found");

    if (!isSandbox() && row.owner === "aurora" && row.provider_ref) {
      const client = await getTenantClient(req.auth.orgId);
      await client.incomingPhoneNumbers(row.provider_ref).remove().catch(() => {});
    }

    await req.supabase
      .from("phone_numbers")
      .delete()
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId);
    res.status(204).end();
  })
);

module.exports = router;

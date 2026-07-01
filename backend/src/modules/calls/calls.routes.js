const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg } = require("../../middleware/auth.middleware");
const { NotFound, BadRequest } = require("../../utils/errors");

const router = express.Router();
router.use(requireAuth, requireOrg);

const listSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  status: z.string().optional(),
  direction: z.enum(["inbound", "outbound"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

router.get(
  "/",
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    let q = req.supabase
      .from("calls")
      .select(
        "id, agent_id, campaign_id, contact_id, direction, status, provider, provider_call_id, started_at, ended_at, duration_sec, cost_usd, recording_url, created_at, from_number, to_number"
      )
      .eq("org_id", req.auth.orgId)
      .order("created_at", { ascending: false })
      .limit(req.query.limit);
    if (req.query.campaign_id) q = q.eq("campaign_id", req.query.campaign_id);
    if (req.query.contact_id) q = q.eq("contact_id", req.query.contact_id);
    if (req.query.status) q = q.eq("status", req.query.status);
    if (req.query.direction) q = q.eq("direction", req.query.direction);
    if (req.query.cursor) q = q.lt("created_at", req.query.cursor);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ calls: data || [] });
  })
);

router.get(
  "/:id",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("calls")
      .select("*")
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw NotFound("Call not found");
    res.json({ call: data });
  })
);

router.get(
  "/:id/events",
  validate({
    params: z.object({ id: z.string().uuid() }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(500).default(100),
      kind: z.string().max(60).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { data: callCheck, error: checkErr } = await req.supabase
      .from("calls")
      .select("id")
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (checkErr) throw checkErr;
    if (!callCheck) throw NotFound("Call not found");

    let q = req.supabase
      .from("call_events")
      .select("id, kind, payload, occurred_at")
      .eq("call_id", req.params.id)
      .order("occurred_at", { ascending: true })
      .limit(req.query.limit);
    if (req.query.kind) q = q.eq("kind", req.query.kind);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ events: data || [] });
  })
);

router.get(
  "/:id/transcript",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("calls")
      .select("id, transcript")
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw NotFound("Call not found");
    res.json({ call_id: data.id, transcript: data.transcript || [] });
  })
);

router.get(
  "/:id/recording",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { data: call, error } = await req.supabase
      .from("calls")
      .select("conversation_id, provider")
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (error) throw error;
    if (!call || !call.conversation_id) throw NotFound("Recording not found");

    if (call.provider !== "elevenlabs") {
      throw BadRequest("Recording only supported for ElevenLabs provider calls");
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ElevenLabs API key not configured on server");
    }

    const elUrl = `https://api.elevenlabs.io/v1/convai/conversations/${call.conversation_id}/audio`;
    const response = await fetch(elUrl, {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch audio from ElevenLabs: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buffer);
  })
);

module.exports = router;

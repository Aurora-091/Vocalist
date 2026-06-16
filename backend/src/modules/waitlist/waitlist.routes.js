const { Router } = require("express");
const { z } = require("zod");
const { requireAdmin } = require("../../config/supabase");
const logger = require("../../config/logger");
const { authLimiter } = require("../../middleware/rate-limit.middleware");
const { sendWaitlistWelcome } = require("../../services/email.service");

const router = Router();

const joinSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional(),
  source: z.string().max(50).default("website"),
  ref: z.string().max(20).optional(),
});

const OFFSET = 43;

router.post("/join", authLimiter, async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "validation_error", message: "Please provide a valid name and email" } });
  }

  const { name, email, phone, source, ref } = parsed.data;
  const admin = requireAdmin();

  // Resolve referrer by short referral code (format: weeber-XXXXXXX)
  let referred_by = null;
  if (ref) {
    const { data: referrer } = await admin.from("waitlist").select("id").eq("referral_code", ref).maybeSingle();
    if (referrer) referred_by = referrer.id;
  }

  const row = { name, email, source };
  if (phone) row.phone = phone;
  if (referred_by) row.referred_by = referred_by;

  const { data: inserted, error } = await admin
    .from("waitlist")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Duplicate — fetch existing referral code to return it
      const { data: existing } = await admin.from("waitlist").select("referral_code").eq("email", email).maybeSingle();
      return res.status(200).json({ success: true, duplicate: true, referral_code: existing?.referral_code || null });
    }
    logger.error({ err: error }, "Waitlist insert failed");
    return res.status(500).json({ error: { code: "internal", message: "Something went wrong" } });
  }

  // Generate short referral code: weeber-<first 7 chars of uuid without dashes>
  const shortCode = "weeber-" + inserted.id.replace(/-/g, "").slice(0, 7);
  await admin.from("waitlist").update({ referral_code: shortCode }).eq("id", inserted.id);

  // Get position in queue (count of rows with created_at <= this row)
  const { count: position } = await admin
    .from("waitlist")
    .select("*", { count: "exact", head: true })
    .lte("created_at", new Date().toISOString());

  const { broadcastWaitlistCount } = require("./waitlist.ws");
  broadcastWaitlistCount();

  void sendWaitlistWelcome(email, name, inserted.id, OFFSET + (position || 1));

  return res.status(201).json({ success: true, referral_code: shortCode });
});

// GET /api/waitlist/unsubscribe?token=<uuid>
router.get("/unsubscribe", async (req, res) => {
  const token = req.query.token;
  if (!token || !/^[0-9a-f-]{36}$/.test(token)) {
    return res.status(400).send(unsubscribePage("Invalid unsubscribe link."));
  }

  const admin = requireAdmin();
  const { error } = await admin
    .from("waitlist")
    .update({ unsubscribed: true })
    .eq("id", token);

  if (error) {
    logger.error({ err: error, token }, "Unsubscribe update failed");
    return res.status(500).send(unsubscribePage("Something went wrong. Please email hello@weeber.ai to unsubscribe."));
  }

  logger.info({ token }, "Waitlist unsubscribe");
  return res.status(200).send(unsubscribePage(null));
});

function unsubscribePage(errorMsg) {
  const body = errorMsg
    ? `<p style="color:#dc2626;font-size:15px;">${errorMsg}</p>`
    : `<h1 style="font-size:22px;font-weight:700;margin:0 0 12px;">You've been unsubscribed.</h1>
       <p style="font-size:15px;color:#64748B;margin:0;">You won't receive any further emails from Weeber. If this was a mistake, email us at <a href="mailto:hello@weeber.ai">hello@weeber.ai</a>.</p>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed — Weeber</title></head>
<body style="margin:0;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FAFAF8;text-align:center;">
  <img src="https://weeber.ai/weeber_logo_transparent.png" alt="Weeber" width="100" style="display:block;margin:0 auto 32px;filter:brightness(0);" />
  <div style="max-width:420px;margin:0 auto;">${body}</div>
</body></html>`;
}

module.exports = router;

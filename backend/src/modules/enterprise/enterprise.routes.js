const { Router } = require("express");
const { z } = require("zod");
const { requireAdmin } = require("../../config/supabase");
const logger = require("../../config/logger");
const { enterpriseLimiter } = require("../../middleware/rate-limit.middleware");
const { sendEnterpriseConfirmation } = require("../../services/email.service");

const router = Router();

const inquireSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(120),
  businessType: z.string().max(100).optional(),
  callVolume: z.string().max(50).optional(),
  painPoint: z.string().max(200).optional(),
  timeline: z.string().max(100).optional(),
  extraInfo: z.string().max(2000).optional(),
});

router.post("/inquire", enterpriseLimiter, async (req, res) => {
  const parsed = inquireSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "validation_error", message: "Please provide a valid name and email" } });
  }

  const { name, email, businessType, callVolume, painPoint, timeline, extraInfo } = parsed.data;
  const admin = requireAdmin();

  const { error } = await admin.from("enterprise_inquiries").insert({
    name,
    email,
    business_type: businessType || null,
    call_volume: callVolume || null,
    pain_point: painPoint || null,
    timeline: timeline || null,
    extra_info: extraInfo || null,
  });

  if (error) {
    logger.error({ err: error }, "Enterprise inquiry insert failed");
    return res.status(500).json({ error: { code: "internal", message: "Something went wrong" } });
  }

  logger.info({ email }, "Enterprise inquiry received");

  void sendEnterpriseConfirmation(email, name);

  return res.status(201).json({ success: true });
});

router.inquireSchema = inquireSchema;
module.exports = router;

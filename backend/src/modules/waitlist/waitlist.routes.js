const { Router } = require("express");
const { z } = require("zod");
const { requireAdmin } = require("../../config/supabase");
const logger = require("../../config/logger");
const { sendWaitlistWelcome } = require("../../services/email.service");

const router = Router();

const joinSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional(),
  source: z.string().max(50).default("website"),
});

router.post("/join", async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "validation_error", message: "Please provide a valid name and email" } });
  }

  const { name, email, phone, source } = parsed.data;
  const admin = requireAdmin();

  const row = { name, email, source };
  if (phone) row.phone = phone;

  const { error } = await admin.from("waitlist").insert(row);

  if (error) {
    if (error.code === "23505") {
      return res.status(200).json({ success: true, duplicate: true });
    }
    logger.error({ err: error }, "Waitlist insert failed");
    return res.status(500).json({ error: { code: "internal", message: "Something went wrong" } });
  }

  const { broadcastWaitlistCount } = require("./waitlist.ws");
  broadcastWaitlistCount();

  void sendWaitlistWelcome(email, name);

  return res.status(201).json({ success: true });
});

module.exports = router;

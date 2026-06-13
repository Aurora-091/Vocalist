const { Router } = require("express");
const { z } = require("zod");
const { requireAdmin } = require("../../config/supabase");
const logger = require("../../config/logger");

const router = Router();

const joinSchema = z.object({
  email: z.string().email(),
  source: z.string().max(50).default("website"),
});

router.post("/join", async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "validation_error", message: "Invalid email address" } });
  }

  const { email, source } = parsed.data;
  const admin = requireAdmin();

  const { error } = await admin.from("waitlist").insert({ email, source });

  if (error) {
    if (error.code === "23505") {
      return res.status(200).json({ success: true, duplicate: true });
    }
    logger.error({ err: error }, "Waitlist insert failed");
    return res.status(500).json({ error: { code: "internal", message: "Something went wrong" } });
  }

  const { broadcastWaitlistCount } = require("./waitlist.ws");
  broadcastWaitlistCount();

  return res.status(201).json({ success: true });
});

module.exports = router;

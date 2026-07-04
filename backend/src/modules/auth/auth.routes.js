const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth } = require("../../middleware/auth.middleware");
const { authLimiter } = require("../../middleware/rate-limit.middleware");
const service = require("./auth.service");
const { signupSchema, loginSchema, refreshSchema, resetSchema } = require("./auth.validator");

const router = express.Router();

router.post(
  "/signup",
  authLimiter,
  validate({ body: signupSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.signup(req.body);
    res.status(201).json(result);
  })
);

router.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.login(req.body);
    res.json(result);
  })
);

router.post(
  "/refresh",
  authLimiter,
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.refresh(req.body);
    res.json(result);
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await service.logout(req.auth.token);
    res.json(result);
  })
);

router.post(
  "/password-reset",
  authLimiter,
  validate({ body: resetSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.requestPasswordReset(req.body);
    res.json(result);
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("users")
      .select("id, email, role, org_id, created_at")
      .eq("id", req.auth.userId)
      .maybeSingle();
    if (error) throw error;
    res.json({ user: data });
  })
);

module.exports = router;

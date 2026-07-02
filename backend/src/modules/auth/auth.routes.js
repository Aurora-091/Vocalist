const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth } = require("../../middleware/auth.middleware");
const { authLimiter } = require("../../middleware/rate-limit.middleware");
const service = require("./auth.service");
const { signupSchema, loginSchema, refreshSchema, resetSchema } = require("./auth.validator");

const router = express.Router();

const isProd = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function setAuthCookies(res, session) {
  if (session?.access_token) {
    res.cookie("sb-access-token", session.access_token, cookieOptions);
  }
  if (session?.refresh_token) {
    res.cookie("sb-refresh-token", session.refresh_token, cookieOptions);
  }
}

function clearAuthCookies(res) {
  res.clearCookie("sb-access-token", cookieOptions);
  res.clearCookie("sb-refresh-token", cookieOptions);
}

router.post(
  "/signup",
  authLimiter,
  validate({ body: signupSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.signup(req.body);
    setAuthCookies(res, result.session);
    res.status(201).json(result);
  })
);

router.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.login(req.body);
    setAuthCookies(res, result.session);
    res.json(result);
  })
);

router.post(
  "/refresh",
  authLimiter,
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    // Check if refresh_token is in body or cookies
    const refresh_token = req.body.refresh_token || req.cookies?.["sb-refresh-token"];
    if (!refresh_token) throw new Error("Missing refresh token");
    const result = await service.refresh({ refresh_token });
    setAuthCookies(res, result.session);
    res.json(result);
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await service.logout(req.auth.token);
    clearAuthCookies(res);
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

const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const env = require("../config/env");

function keyForReq(req, res) {
  if (req.auth?.orgId) return `org:${req.auth.orgId}`;
  if (req.auth?.userId) return `user:${req.auth.userId}`;
  return ipKeyGenerator(req, res);
}

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: keyForReq,
  message: { error: { code: "rate_limited", message: "Too many requests" } },
});

const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// Strict limiter for unauthenticated, abuse-prone endpoints
// (login, signup, password reset, waitlist join). Keyed by IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
  message: { error: { code: "rate_limited", message: "Too many attempts. Please try again shortly." } },
});

module.exports = { apiLimiter, webhookLimiter, authLimiter };

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

// Strict limiter for unauthenticated, abuse-prone endpoints (login, signup, password reset).
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
  message: { error: { code: "rate_limited", message: "Too many attempts. Please try again shortly." } },
});

// Generous limiter for the public waitlist join endpoint.
const waitlistLimiter = rateLimit({
  windowMs: 60_000,
  max: 80,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
  message: { error: { code: "rate_limited", message: "Too many attempts. Please try again shortly." } },
});

// Mid-tier limiter for the enterprise inquiry endpoint.
const enterpriseLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req, res) => ipKeyGenerator(req, res),
  message: { error: { code: "rate_limited", message: "Too many attempts. Please try again shortly." } },
});

// Strict limiter for expensive operations (agent sync, campaign launch, knowledge ingestion).
const expensiveOpsLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: keyForReq,
  message: { error: { code: "rate_limited", message: "Too many requests for this operation. Please wait." } },
});

// Web test call sessions — 10 per org per hour.
const webSessionLimiter = rateLimit({
  windowMs: 3_600_000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: keyForReq,
  message: { error: { code: "rate_limited", message: "Web test call limit reached. Try again later." } },
});

module.exports = { apiLimiter, webhookLimiter, authLimiter, waitlistLimiter, enterpriseLimiter, expensiveOpsLimiter, webSessionLimiter };

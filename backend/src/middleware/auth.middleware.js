const jwt = require("jsonwebtoken");
const { Unauthorized, Forbidden } = require("../utils/errors");
const { clientForToken } = require("../config/supabase");
const env = require("../config/env");
const logger = require("../config/logger");
const asyncHandler = require("../utils/asyncHandler");

function decodeBearer(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = decodeBearer(req);
  if (!token) throw Unauthorized("Missing bearer token");

  let decoded;
  if (env.SUPABASE_JWT_SECRET) {
    // Cryptographically verify the token signature before trusting any claims.
    try {
      decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      throw Unauthorized("Invalid or expired token");
    }
  } else if (env.NODE_ENV !== "production") {
    // Dev/test convenience only: no secret configured, so fall back to an
    // unverified decode. This branch is unreachable in production because
    // SUPABASE_JWT_SECRET is required there (see config/env.js).
    logger.warn("SUPABASE_JWT_SECRET not set — decoding JWT WITHOUT signature verification (non-production only)");
    try {
      decoded = jwt.decode(token);
    } catch {
      throw Unauthorized("Invalid token");
    }
  } else {
    throw Unauthorized("Token verification unavailable");
  }
  if (!decoded || typeof decoded !== "object") throw Unauthorized("Invalid token");

  const sub = decoded.sub;
  const orgId = decoded.org_id || decoded.app_metadata?.org_id;
  if (!sub) throw Unauthorized("Token missing subject");

  req.auth = {
    userId: sub,
    orgId: orgId || null,
    email: decoded.email || null,
    role: decoded.app_metadata?.role || decoded.role || null,
    token,
  };
  req.supabase = clientForToken(token);
  next();
});

const requireOrg = (req, _res, next) => {
  if (!req.auth?.orgId) {
    return next(Forbidden("User has no organization context"));
  }
  next();
};

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.auth?.role || !roles.includes(req.auth.role)) {
    return next(Forbidden(`Requires role: ${roles.join(", ")}`));
  }
  next();
};

module.exports = { requireAuth, requireOrg, requireRole };

const { Unauthorized, Forbidden } = require("../utils/errors");
const { requireAdmin, clientForToken } = require("../config/supabase");
const asyncHandler = require("../utils/asyncHandler");

function decodeBearer(req) {
  // Always prefer the Authorization header — the Supabase JS SDK sends a fresh
  // Bearer token on every request and refreshes it automatically. If we prefer
  // the httpOnly cookie we risk reading a stale token even after the SDK has
  // already refreshed the session, which creates infinite 401 retry loops.
  const header = req.headers.authorization || req.headers.Authorization;
  if (header && typeof header === "string") {
    const [scheme, token] = header.split(" ");
    if (scheme === "Bearer" && token) return token;
  }
  // Fallback: cookie-based auth for non-JS clients (e.g. server-side rendering,
  // curl testing) that do not send an Authorization header.
  if (req.cookies && req.cookies["sb-access-token"]) {
    return req.cookies["sb-access-token"];
  }
  return null;
}

const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = decodeBearer(req);
  if (!token) throw Unauthorized("Missing bearer token");

  // Verify via Supabase — compatible with both legacy HS256 and new ECC P-256 signing keys.
  const admin = requireAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw Unauthorized("Invalid or expired token");

  const user = data.user;
  const orgId = user.app_metadata?.org_id || null;

  req.auth = {
    userId: user.id,
    orgId,
    email: user.email || null,
    role: user.app_metadata?.role || user.role || null,
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

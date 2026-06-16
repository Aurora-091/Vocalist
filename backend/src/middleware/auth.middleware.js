const { Unauthorized, Forbidden } = require("../utils/errors");
const { requireAdmin, clientForToken } = require("../config/supabase");
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

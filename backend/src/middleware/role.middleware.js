const ApiError = require("../utils/ApiError");

const VALID_ROLES = ["owner", "admin", "ops"];

/**
 * requireRole("owner") or requireRole("owner", "admin")
 * Allows access only if req.user.role is one of the provided roles.
 */
function requireRole(...roles) {
  const allowed = roles.flat().filter(Boolean);
  for (const role of allowed) {
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`requireRole: unknown role "${role}"`);
    }
  }

  return function roleGuard(req, res, next) {
    if (!req.user || !req.user.role) {
      return next(ApiError.unauthorized("Authentication required"));
    }
    if (!allowed.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Requires role(s): ${allowed.join(", ")}. Current role: ${req.user.role}`
        )
      );
    }
    next();
  };
}

module.exports = { requireRole, VALID_ROLES };

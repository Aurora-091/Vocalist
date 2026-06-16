const { requireAdmin } = require("../config/supabase");
const { Forbidden } = require("../utils/errors");
const asyncHandler = require("../utils/asyncHandler");

const requireSuperAdmin = asyncHandler(async (req, _res, next) => {
  if (!req.auth?.userId) {
    throw Forbidden("Not authenticated");
  }

  const admin = requireAdmin();
  const { data: user, error } = await admin
    .from("users")
    .select("platform_role")
    .eq("id", req.auth.userId)
    .single();

  if (error || !user || user.platform_role !== "super_admin") {
    throw Forbidden("Insufficient platform privileges");
  }

  req.platformRole = "super_admin";
  next();
});

module.exports = { requireSuperAdmin };

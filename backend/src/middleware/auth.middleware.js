const supabase = require("../config/db");
const userRepository = require("../modules/users/user.repository");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function extractBearerToken(req) {
  const header = req.headers["authorization"] || req.headers["Authorization"];
  if (!header || typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

const authMiddleware = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    throw ApiError.unauthorized("Missing or malformed Authorization header");
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw ApiError.unauthorized("Invalid or expired access token");
  }

  const authUser = data.user;
  const profile = await userRepository.findById(authUser.id);
  if (!profile) {
    throw ApiError.unauthorized("User profile not found for authenticated user");
  }

  req.user = {
    id: profile.id,
    org_id: profile.org_id,
    role: profile.role,
    email: profile.email,
  };
  req.accessToken = token;
  req.authUser = authUser;

  next();
});

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;

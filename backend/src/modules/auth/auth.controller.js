const asyncHandler = require("../../utils/asyncHandler");
const { success, created } = require("../../utils/ApiResponse");
const authService = require("./auth.service");

const register = asyncHandler(async (req, res) => {
  const { organizationName, ownerName, email, password } = req.body || {};
  const result = await authService.register({
    organizationName,
    ownerName,
    email,
    password,
  });
  return created(
    res,
    {
      organizationId: result.organizationId,
      userId: result.userId,
      organization: result.organization,
      user: result.user,
      subscription: result.subscription,
      session: result.session,
    },
    "Organization registered"
  );
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const result = await authService.login({ email, password });
  return success(res, result);
});

module.exports = { register, login };

const asyncHandler = require("../../utils/asyncHandler");
const { success, created } = require("../../utils/ApiResponse");
const userService = require("./user.service");

const list = asyncHandler(async (req, res) => {
  const users = await userService.listUsers({ orgId: req.user.org_id });
  return success(res, { users });
});

const invite = asyncHandler(async (req, res) => {
  const { email, role } = req.body || {};
  const user = await userService.inviteUser({
    orgId: req.user.org_id,
    inviterRole: req.user.role,
    email,
    role,
  });
  return created(res, { user }, "Invitation sent");
});

const updateRole = asyncHandler(async (req, res) => {
  const { role } = req.body || {};
  const user = await userService.changeRole({
    orgId: req.user.org_id,
    actorRole: req.user.role,
    targetUserId: req.params.id,
    newRole: role,
  });
  return success(res, { user });
});

const remove = asyncHandler(async (req, res) => {
  const result = await userService.deleteUser({
    orgId: req.user.org_id,
    actorId: req.user.id,
    actorRole: req.user.role,
    targetUserId: req.params.id,
  });
  return success(res, result, 200, "User removed");
});

module.exports = { list, invite, updateRole, remove };

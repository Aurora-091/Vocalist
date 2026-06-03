const supabase = require("../../config/db");
const env = require("../../config/env");
const userRepository = require("./user.repository");
const ApiError = require("../../utils/ApiError");
const { VALID_ROLES } = require("../../middleware/role.middleware");
const { isEmail, isUuid } = require("../../utils/validators");

async function listUsers({ orgId }) {
  return userRepository.listByOrg(orgId);
}

async function inviteUser({ orgId, inviterRole, email, role }) {
  if (!isEmail(email)) {
    throw ApiError.badRequest("A valid email is required");
  }
  const requestedRole = role || "ops";
  if (!VALID_ROLES.includes(requestedRole)) {
    throw ApiError.badRequest(
      `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`
    );
  }
  if (requestedRole === "owner") {
    throw ApiError.forbidden("Cannot invite another user as owner");
  }
  if (requestedRole === "admin" && inviterRole !== "owner") {
    throw ApiError.forbidden("Only the owner can invite admins");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await userRepository.findByEmailInOrg(normalizedEmail, orgId);
  if (existing) {
    throw ApiError.conflict("A user with this email already exists in the organization");
  }

  const inviteOptions = {
    data: { org_id: orgId, role: requestedRole },
  };
  if (env.APP_INVITE_REDIRECT_URL) {
    inviteOptions.redirectTo = env.APP_INVITE_REDIRECT_URL;
  }

  const { data: invitation, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(normalizedEmail, inviteOptions);
  if (inviteError) {
    if (/already/i.test(inviteError.message)) {
      throw ApiError.conflict(inviteError.message);
    }
    throw ApiError.badRequest(`Failed to send invitation: ${inviteError.message}`);
  }

  const authUserId = invitation?.user?.id;
  if (!authUserId) {
    throw ApiError.internal("Invitation succeeded but no user id was returned");
  }

  let profile;
  try {
    profile = await userRepository.create({
      id: authUserId,
      orgId,
      email: normalizedEmail,
      role: requestedRole,
    });
  } catch (err) {
    await supabase.auth.admin.deleteUser(authUserId).catch(() => undefined);
    throw err;
  }

  return profile;
}

async function changeRole({ orgId, actorRole, targetUserId, newRole }) {
  if (!isUuid(targetUserId)) {
    throw ApiError.badRequest("Invalid user id");
  }
  if (!VALID_ROLES.includes(newRole)) {
    throw ApiError.badRequest(
      `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`
    );
  }
  if (actorRole !== "owner") {
    throw ApiError.forbidden("Only the owner can change user roles");
  }
  if (newRole === "owner") {
    throw ApiError.forbidden("Ownership transfer is not supported via this endpoint");
  }

  const target = await userRepository.findByIdInOrg(targetUserId, orgId);
  if (!target) {
    throw ApiError.notFound("User not found in this organization");
  }
  if (target.role === "owner") {
    throw ApiError.forbidden("Cannot change the role of the organization owner");
  }
  if (target.role === newRole) {
    return target;
  }

  return userRepository.updateRole({
    id: targetUserId,
    orgId,
    role: newRole,
  });
}

async function deleteUser({ orgId, actorId, actorRole, targetUserId }) {
  if (!isUuid(targetUserId)) {
    throw ApiError.badRequest("Invalid user id");
  }
  if (actorRole !== "owner" && actorRole !== "admin") {
    throw ApiError.forbidden("Only owners or admins can remove users");
  }
  if (actorId === targetUserId) {
    throw ApiError.forbidden("You cannot remove your own account");
  }

  const target = await userRepository.findByIdInOrg(targetUserId, orgId);
  if (!target) {
    throw ApiError.notFound("User not found in this organization");
  }
  if (target.role === "owner") {
    throw ApiError.forbidden("The organization owner cannot be deleted");
  }
  if (target.role === "admin" && actorRole !== "owner") {
    throw ApiError.forbidden("Only the owner can remove admins");
  }

  await userRepository.deleteByIdInOrg(targetUserId, orgId);

  const { error: authError } = await supabase.auth.admin.deleteUser(targetUserId);
  if (authError) {
    console.warn(
      `[users] Removed users row ${targetUserId} but failed to delete auth user: ${authError.message}`
    );
  }

  return { id: targetUserId };
}

module.exports = {
  listUsers,
  inviteUser,
  changeRole,
  deleteUser,
};

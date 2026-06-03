const env = require("../../config/env");
const ApiError = require("../../utils/ApiError");
const { isEmail, isNonEmptyString, isStrongPassword } = require("../../utils/validators");

const authRepository = require("./auth.repository");
const organizationRepository = require("../organizations/organization.repository");
const userRepository = require("../users/user.repository");

function isAnonAvailable() {
  return Boolean(env.SUPABASE_ANON_KEY);
}

async function register({ organizationName, ownerName, email, password }) {
  if (!isNonEmptyString(organizationName)) {
    throw ApiError.badRequest("organizationName is required");
  }
  if (!isNonEmptyString(ownerName)) {
    throw ApiError.badRequest("ownerName is required");
  }
  if (!isEmail(email)) {
    throw ApiError.badRequest("A valid email is required");
  }
  if (!isStrongPassword(password)) {
    throw ApiError.badRequest(
      "Password must be at least 8 characters and include letters and numbers"
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedOrgName = organizationName.trim();
  const trimmedOwnerName = ownerName.trim();

  let authUser;
  try {
    authUser = await authRepository.createAuthUser({
      email: normalizedEmail,
      password,
      metadata: { full_name: trimmedOwnerName },
    });
  } catch (err) {
    if (/registered|exists/i.test(err.message || "")) {
      throw ApiError.conflict("A user with this email already exists");
    }
    throw ApiError.badRequest(`Could not create user: ${err.message}`);
  }

  let organization;
  let userProfile;
  let subscription;

  try {
    organization = await organizationRepository.create({
      name: trimmedOrgName,
      planId: env.DEFAULT_PLAN_ID,
    });

    userProfile = await userRepository.create({
      id: authUser.id,
      orgId: organization.id,
      email: normalizedEmail,
      role: "owner",
    });

    subscription = await organizationRepository.createDefaultSubscription({
      orgId: organization.id,
      planId: env.DEFAULT_PLAN_ID,
      includedMinutes: env.DEFAULT_PLAN_INCLUDED_MINUTES,
      status: "active",
    });
  } catch (err) {
    if (organization?.id) {
      await organizationRepository
        .deleteById(organization.id)
        .catch(() => undefined);
    }
    await authRepository.deleteAuthUser(authUser.id).catch(() => undefined);
    throw ApiError.internal(
      `Registration rolled back: ${err.message || "unknown error"}`
    );
  }

  let session = null;
  if (isAnonAvailable()) {
    try {
      const signIn = await authRepository.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      session = signIn?.session || null;
    } catch (err) {
      console.warn(
        `[auth] Registration succeeded but session generation failed: ${err.message}`
      );
    }
  }

  return {
    organizationId: organization.id,
    userId: userProfile.id,
    organization,
    user: { ...userProfile, name: trimmedOwnerName },
    subscription,
    session,
  };
}

async function login({ email, password }) {
  if (!isEmail(email)) {
    throw ApiError.badRequest("A valid email is required");
  }
  if (!isNonEmptyString(password)) {
    throw ApiError.badRequest("password is required");
  }
  if (!isAnonAvailable()) {
    throw ApiError.internal(
      "Login is not configured: SUPABASE_ANON_KEY is missing"
    );
  }

  let signIn;
  try {
    signIn = await authRepository.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
  } catch (err) {
    throw ApiError.unauthorized(err.message || "Invalid email or password");
  }

  const session = signIn?.session;
  const authUser = signIn?.user;
  if (!session || !authUser) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const profile = await userRepository.findById(authUser.id);
  if (!profile) {
    throw ApiError.unauthorized(
      "Authenticated user has no profile in this application"
    );
  }

  const organization = await organizationRepository.findById(profile.org_id);

  return {
    token: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    user: {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      org_id: profile.org_id,
      created_at: profile.created_at,
    },
    organization,
    role: profile.role,
  };
}

module.exports = { register, login };

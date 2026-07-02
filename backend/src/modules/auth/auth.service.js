const supabaseConfig = require("../../config/supabase");
const { Unauthorized, BadRequest, Conflict } = require("../../utils/errors");

async function signup({ email, password, org_name }) {
  const admin = supabaseConfig.requireAdmin();

  // 1. Check if user already exists in public database
  const { data: existingDbUser } = await admin
    .from("users")
    .select("id, org_id")
    .eq("email", email)
    .maybeSingle();

  if (existingDbUser) {
    throw Conflict("User already exists");
  }

  // 2. Create organization
  const { data: orgRow, error: orgErr } = await admin
    .from("orgs")
    .insert({ name: org_name || `${email}'s org`, plan_id: "starter" })
    .select("id, name, plan_id, created_at")
    .single();
  if (orgErr) throw new Error(`Failed to create org: ${orgErr.message}`);

  let userId;
  let userObject;

  // 3. Try to create the auth user
  const { data: created, error: signErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { org_id: orgRow.id, role: "owner" },
  });

  if (signErr) {
    // If it's an "already exists" error, throw a conflict so the user knows they need to log in or reset password.
    if (signErr.message?.toLowerCase().includes("already")) {
      await admin.from("orgs").delete().eq("id", orgRow.id);
      throw Conflict("Account with this email already exists. Please log in or reset your password.");
    } else {
      await admin.from("orgs").delete().eq("id", orgRow.id);
      throw new Error(signErr.message);
    }
  } else {
    userId = created.user.id;
    userObject = created.user;
  }

  // 4. Insert database row in public.users
  const { error: linkErr } = await admin
    .from("users")
    .insert({ id: userId, org_id: orgRow.id, email, role: "owner", display_name: org_name || email.split("@")[0] });
  if (linkErr) {
    // Only delete the newly created auth user (don't delete if we healed an existing one)
    if (!signErr) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
    }
    try {
      await admin.from("orgs").delete().eq("id", orgRow.id);
    } catch (e) {}
    if (linkErr.code === "23505") throw Conflict("User already exists");
    throw new Error(`Failed to link user: ${linkErr.message}`);
  }

  // Initialize onboarding state
  try {
    await admin.from("onboarding_state").insert({
      org_id: orgRow.id,
      steps: { pick_vertical: false, connect_tools: false, add_knowledge: false, create_agent: false, get_number: false, test_and_golive: false },
    });
  } catch (e) {}

  // Proactively create Twilio subaccount and link it to the org
  try {
    const { getOrCreateSubaccount } = require("../twilio/twilio.client");
    await getOrCreateSubaccount(orgRow.id, org_name || `${email}'s org`);
  } catch (err) {
    const logger = require("../../config/logger");
    logger.error({ err: err.message, orgId: orgRow.id }, "Failed to proactively create Twilio subaccount during signup");
  }

  const { data: session, error: sessErr } = await supabaseConfig.anonClient.auth.signInWithPassword({
    email,
    password,
  });
  if (sessErr) throw new Error(sessErr.message);

  return { user: session.user, session: session.session, org: orgRow };
}

async function login({ email, password }) {
  const { data, error } = await supabaseConfig.anonClient.auth.signInWithPassword({ email, password });
  if (error) throw Unauthorized(error.message);
  return { user: data.user, session: data.session };
}

async function refresh({ refresh_token }) {
  const { data, error } = await supabaseConfig.anonClient.auth.refreshSession({ refresh_token });
  if (error) throw Unauthorized(error.message);
  return { session: data.session, user: data.user };
}

async function logout(token) {
  if (!token) throw BadRequest("Missing token");
  const admin = supabaseConfig.requireAdmin();
  const { error } = await admin.auth.admin.signOut(token, "global").catch(e => ({ error: e }));
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function requestPasswordReset({ email, redirect_to }) {
  const { error } = await supabaseConfig.anonClient.auth.resetPasswordForEmail(email, {
    redirectTo: redirect_to,
  });
  if (error) {
    const logger = require("../../config/logger");
    logger.warn({ err: error.message, email }, "Password reset failed (preventing enumeration)");
  }
  return { ok: true };
}

module.exports = { signup, login, refresh, logout, requestPasswordReset };

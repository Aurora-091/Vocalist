const { anonClient, requireAdmin } = require("../../config/supabase");
const { Unauthorized, BadRequest, Conflict } = require("../../utils/errors");

async function signup({ email, password, org_name }) {
  const admin = requireAdmin();

  const { data: orgRow, error: orgErr } = await admin
    .from("orgs")
    .insert({ name: org_name || `${email}'s org`, plan_id: "starter" })
    .select("id, name, plan_id, created_at")
    .single();
  if (orgErr) throw new Error(`Failed to create org: ${orgErr.message}`);

  const { data: created, error: signErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { org_id: orgRow.id, role: "owner" },
  });
  if (signErr) {
    await admin.from("orgs").delete().eq("id", orgRow.id);
    if (signErr.message?.toLowerCase().includes("already")) throw Conflict("User already exists");
    throw new Error(signErr.message);
  }

  const userId = created.user.id;
  const { error: linkErr } = await admin
    .from("users")
    .insert({ id: userId, org_id: orgRow.id, email, role: "owner", display_name: org_name || email.split("@")[0] });
  if (linkErr) throw new Error(`Failed to link user: ${linkErr.message}`);

  // Initialize onboarding state
  await admin.from("onboarding_state").insert({
    org_id: orgRow.id,
    steps: { pick_vertical: false, connect_tools: false, add_knowledge: false, create_agent: false, get_number: false, test_and_golive: false },
  }).catch(() => {});

  const { data: session, error: sessErr } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });
  if (sessErr) throw new Error(sessErr.message);

  return { user: session.user, session: session.session, org: orgRow };
}

async function login({ email, password }) {
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
  if (error) throw Unauthorized(error.message);
  return { user: data.user, session: data.session };
}

async function refresh({ refresh_token }) {
  const { data, error } = await anonClient.auth.refreshSession({ refresh_token });
  if (error) throw Unauthorized(error.message);
  return { session: data.session, user: data.user };
}

async function logout(token) {
  if (!token) throw BadRequest("Missing token");
  const { error } = await anonClient.auth.admin?.signOut?.(token) ?? { error: null };
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function requestPasswordReset({ email, redirect_to }) {
  const { error } = await anonClient.auth.resetPasswordForEmail(email, {
    redirectTo: redirect_to,
  });
  if (error) throw BadRequest(error.message);
  return { ok: true };
}

module.exports = { signup, login, refresh, logout, requestPasswordReset };

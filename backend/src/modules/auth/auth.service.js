const { anonClient, requireAdmin } = require("../../config/supabase");
const { Unauthorized, BadRequest, Conflict } = require("../../utils/errors");
const { sendOrphanHealEmail } = require("../../services/email.service");

async function findAuthUserByEmail(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return null;
  return data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function signup({ email, password, org_name }) {
  const admin = requireAdmin();

  // Detect auth-orphan: auth.users row exists but public.users row is missing
  const existingAuthUser = await findAuthUserByEmail(admin, email);
  if (existingAuthUser) {
    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("id", existingAuthUser.id)
      .maybeSingle();

    if (existingUser) {
      throw Conflict("User already exists");
    }

    // Orphan — heal: create org + public.users + onboarding_state, then send recovery link
    const { data: orgRow, error: orgErr } = await admin
      .from("orgs")
      .insert({ name: org_name || `${email}'s org`, plan_id: "starter" })
      .select("id, name, plan_id, created_at")
      .single();
    if (orgErr) throw new Error(`Failed to create org: ${orgErr.message}`);

    const { error: linkErr } = await admin.from("users").insert({
      id: existingAuthUser.id,
      org_id: orgRow.id,
      email,
      role: "owner",
      display_name: org_name || email.split("@")[0],
    });
    if (linkErr) {
      await admin.from("orgs").delete().eq("id", orgRow.id).catch(() => {});
      throw new Error(`Failed to link orphan user: ${linkErr.message}`);
    }

    await admin.from("onboarding_state").insert({
      org_id: orgRow.id,
      steps: { pick_vertical: false, connect_tools: false, add_knowledge: false, create_agent: false, get_number: false, test_and_golive: false },
    }).catch(() => {});

    const { data: linkData, error: genErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (!genErr && linkData?.properties?.action_link) {
      void sendOrphanHealEmail(email, org_name || email.split("@")[0], linkData.properties.action_link);
    }

    return { healed: true, message: "Account recovered. Check your email to set your password." };
  }

  // Normal signup path
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
  if (linkErr) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch {}
    try {
      await admin.from("orgs").delete().eq("id", orgRow.id);
    } catch {}
    if (linkErr.code === "23505") throw Conflict("User already exists");
    throw new Error(`Failed to link user: ${linkErr.message}`);
  }

  // Initialize onboarding state
  try {
    await admin.from("onboarding_state").insert({
      org_id: orgRow.id,
      steps: { pick_vertical: false, connect_tools: false, add_knowledge: false, create_agent: false, get_number: false, test_and_golive: false },
    });
  } catch {}

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

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
    // If it's an "already exists" error, check if we can heal an orphaned auth user
    if (signErr.message?.toLowerCase().includes("already")) {
      // Find the existing auth user's ID
      const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
      const existingAuthUser = users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

      if (existingAuthUser) {
        userId = existingAuthUser.id;
        // Update the orphaned user's password and app_metadata
        const { data: updatedUser, error: updateErr } = await admin.auth.admin.updateUserById(userId, {
          password,
          app_metadata: { org_id: orgRow.id, role: "owner" },
        });
        if (updateErr) {
          await admin.from("orgs").delete().eq("id", orgRow.id);
          throw new Error(`Failed to heal orphaned user: ${updateErr.message}`);
        }
        userObject = updatedUser.user;
      } else {
        await admin.from("orgs").delete().eq("id", orgRow.id);
        throw Conflict("User already exists");
      }
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
  const { error } = await supabaseConfig.anonClient.auth.admin?.signOut?.(token) ?? { error: null };
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function requestPasswordReset({ email, redirect_to }) {
  const { error } = await supabaseConfig.anonClient.auth.resetPasswordForEmail(email, {
    redirectTo: redirect_to,
  });
  if (error) throw BadRequest(error.message);
  return { ok: true };
}

module.exports = { signup, login, refresh, logout, requestPasswordReset };

const supabase = require("../../config/db");
const { getAnonClient } = require("../../config/db");

async function createAuthUser({ email, password, metadata = {} }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error) throw error;
  return data.user;
}

async function deleteAuthUser(userId) {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw error;
}

async function signInWithPassword({ email, password }) {
  const client = getAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

module.exports = {
  createAuthUser,
  deleteAuthUser,
  signInWithPassword,
};

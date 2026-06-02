const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

const baseOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
};

const adminClient = env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, baseOptions)
  : null;

const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, baseOptions);

function clientForToken(jwt) {
  if (!jwt) return anonClient;
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    ...baseOptions,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

function requireAdmin() {
  if (!adminClient) {
    throw new Error(
      "Service role operation attempted without SUPABASE_SERVICE_ROLE_KEY configured."
    );
  }
  return adminClient;
}

module.exports = { adminClient, anonClient, clientForToken, requireAdmin };

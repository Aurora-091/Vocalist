const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");
const env = require("./env");

const { fetchWithRetry } = require("../utils/retry");

const baseOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: fetchWithRetry, WebSocket },
};

const adminClient = env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, baseOptions)
  : null;

const anonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, baseOptions);

function clientForToken(jwt) {
  if (!jwt) return anonClient;
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    ...baseOptions,
    global: {
      ...baseOptions.global,
      headers: { Authorization: `Bearer ${jwt}` },
    },
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

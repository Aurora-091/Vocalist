const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function getAnonClient() {
  if (!env.SUPABASE_ANON_KEY) {
    throw new Error(
      "SUPABASE_ANON_KEY is required for end-user authentication flows"
    );
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

module.exports = supabase;
module.exports.supabase = supabase;
module.exports.getAnonClient = getAnonClient;

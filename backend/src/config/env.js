require("dotenv").config();

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[env] Missing required environment variable: ${key}`);
  }
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 3000,

  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,

  DEFAULT_PLAN_ID: process.env.DEFAULT_PLAN_ID || "free",
  DEFAULT_PLAN_INCLUDED_MINUTES: parseInt(
    process.env.DEFAULT_PLAN_INCLUDED_MINUTES || "0",
    10
  ),

  APP_INVITE_REDIRECT_URL: process.env.APP_INVITE_REDIRECT_URL,
};

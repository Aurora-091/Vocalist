const { requireAdmin } = require("../config/supabase");
const logger = require("../config/logger");

async function readSecret(ref) {
  if (!ref || typeof ref !== "string" || !ref.startsWith("vault:")) return ref;
  const admin = requireAdmin();
  try {
    const { data, error } = await admin.rpc("vault_read", { name: ref });
    if (error) {
      logger.error({ err: error.message, ref }, "Failed to read secret from vault via RPC");
      throw new Error(`vault_read failed for ${ref}: ${error.message}`);
    }
    return data;
  } catch (err) {
    logger.error({ err: err.message, ref }, "Exception during vault_read RPC");
    throw err;
  }
}

async function writeSecret(name, value) {
  if (!name || value === undefined || value === null) {
    throw new Error("writeSecret name and value are required");
  }
  const admin = requireAdmin();
  try {
    const { error } = await admin.rpc("vault_store", { name, secret: value });
    if (error) {
      logger.error({ err: error.message, name }, "Failed to store secret in vault via RPC");
      throw new Error(`vault_store failed for ${name}: ${error.message}`);
    }
    return name;
  } catch (err) {
    logger.error({ err: err.message, name }, "Exception during vault_store RPC");
    throw err;
  }
}

async function resolveConfigSecrets(config) {
  if (!config || typeof config !== "object") return config;
  const resolved = { ...config };
  for (const [key, val] of Object.entries(resolved)) {
    if (typeof val === "string" && val.startsWith("vault:")) {
      resolved[key] = await readSecret(val);
    }
  }
  return resolved;
}

const VAULT_FIELDS = {
  shopify: ["access_token"],
  twilio: ["auth_token"],
  calcom: ["api_key"],
  google_cal: ["access_token", "refresh_token"],
  outlook_cal: ["access_token", "refresh_token"],
  crm: ["access_token", "refresh_token", "api_key"],
  hubspot: ["access_token", "refresh_token", "api_key"],
  zapier: ["hook_secret", "api_key"],
};

async function vaultifyConfig(type, config, orgId) {
  const fields = VAULT_FIELDS[type] || [];
  const safeConfig = { ...config };
  for (const field of fields) {
    if (safeConfig[field] && !String(safeConfig[field]).startsWith("vault:")) {
      const vaultKey = `vault:integrations:${type}:${field}:${orgId}`;
      await writeSecret(vaultKey, safeConfig[field]);
      safeConfig[field] = vaultKey;
    }
  }
  return safeConfig;
}

module.exports = { readSecret, writeSecret, resolveConfigSecrets, vaultifyConfig };

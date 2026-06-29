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

module.exports = { readSecret, writeSecret, resolveConfigSecrets };

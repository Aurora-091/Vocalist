const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildProvider, listProviderNames } = require("../../modules/integrations/integration.service");

// Mock Database
function makeMockDatabase() {
  const store = {
    vault: {},
  };
  return {
    store,
    rpc: async (fn, args) => {
      if (fn === "vault_store") {
        store.vault[args.name] = args.secret;
        return { error: null };
      }
      if (fn === "vault_read") {
        const val = store.vault[args.name];
        return { data: val, error: null };
      }
      return { error: new Error(`unknown RPC: ${fn}`) };
    },
  };
}

const supabaseConfig = require("../../config/supabase");

test("Vaultify and Resolve config credentials", async () => {
  const db = makeMockDatabase();
  supabaseConfig.setMockAdminClient(db);

  const { resolveConfigSecrets } = require("../../utils/credential.helper");
  
  const type = "shopify";
  const orgId = "org-123";
  const originalConfig = {
    shop_domain: "test.myshopify.com",
    access_token: "shpua_testtoken123",
  };

  const VAULT_FIELDS = {
    shopify: ["access_token"],
    twilio: ["auth_token"],
  };
  
  async function testVaultify(type, config, orgId) {
    const { writeSecret } = require("../../utils/credential.helper");
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

  const safeConfig = await testVaultify(type, originalConfig, orgId);

  assert.equal(safeConfig.shop_domain, "test.myshopify.com");
  assert.equal(safeConfig.access_token, "vault:integrations:shopify:access_token:org-123");
  assert.equal(db.store.vault["vault:integrations:shopify:access_token:org-123"], "shpua_testtoken123");

  const resolved = await resolveConfigSecrets(safeConfig);
  assert.equal(resolved.shop_domain, "test.myshopify.com");
  assert.equal(resolved.access_token, "shpua_testtoken123");

  supabaseConfig.setMockAdminClient(null);
});

test("buildProvider handles all allowed integration types without crashing", () => {
  const allowed = listProviderNames();
  assert.deepEqual(allowed, [
    "shopify", "hubspot", "pipedrive", "freshsales", "cliniko", "jane_app",
    "calcom", "whatsapp", "zoho_crm", "salesforce", "drchrono"
  ]);

  for (const type of allowed) {
    const provider = buildProvider(type, "org-abc", { shop_domain: "test.myshopify.com", access_token: "test" });
    assert.ok(provider);
    assert.equal(typeof provider.testConnection, "function");
    assert.equal(typeof provider.syncContacts, "function");
  }
});

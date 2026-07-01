const assert = require("node:assert/strict");
const { test } = require("node:test");
const agentService = require("../../modules/agents/agent.service");
const { vaultifyConfig } = require("../../utils/credential.helper");
const supabaseConfig = require("../../config/supabase");

// Mock Database representing Supabase
function makeMockDatabase() {
  const store = {
    vault: {},
    agents: [],
    organization_agents: [],
    integrations: [],
  };

  return {
    store,
    rpc: async (fn, args) => {
      if (fn === "vault_store") {
        store.vault[args.name] = args.secret;
        return { error: null };
      }
      if (fn === "vault_read") {
        return { data: store.vault[args.name] || null, error: null };
      }
      return { error: new Error(`unknown RPC: ${fn}`) };
    },
    from(table) {
      if (!store[table]) store[table] = [];
      return {
        select: (cols) => {
          const filter = {};
          const chain = {
            eq: (col, val) => {
              filter[col] = val;
              return chain;
            },
            is: (col, val) => {
              filter[col] = val;
              return chain;
            },
            single: async () => {
              const matches = store[table].filter((row) =>
                Object.entries(filter).every(([c, v]) => {
                  if (v === null) return row[c] === null;
                  return row[c] === v;
                })
              );
              return { data: matches[0] || null, error: matches[0] ? null : new Error("Not found") };
            },
            maybeSingle: async () => {
              const matches = store[table].filter((row) =>
                Object.entries(filter).every(([c, v]) => {
                  if (v === null) return row[c] === null;
                  return row[c] === v;
                })
              );
              return { data: matches[0] || null, error: null };
            },
            then: (resolve) => {
              const matches = store[table].filter((row) =>
                Object.entries(filter).every(([c, v]) => {
                  if (v === null) return row[c] === null;
                  return row[c] === v;
                })
              );
              resolve({ data: matches, error: null });
            }
          };
          return chain;
        },
        insert: (row) => {
          const inserted = Array.isArray(row)
            ? row.map((r) => ({ id: "id-" + Math.random(), ...r }))
            : { id: "id-" + Math.random(), ...row };
          if (Array.isArray(inserted)) {
            store[table].push(...inserted);
          } else {
            store[table].push(inserted);
          }
          return {
            select: () => ({
              single: async () => ({ data: inserted, error: null }),
            }),
            single: async () => ({ data: inserted, error: null }),
          };
        },
        upsert: (row, options) => {
          const rows = Array.isArray(row) ? row : [row];
          const conflictCols = options && options.onConflict ? options.onConflict.split(",") : [];
          for (const r of rows) {
            let existingIdx = -1;
            if (conflictCols.length > 0) {
              existingIdx = store[table].findIndex((item) =>
                conflictCols.every((col) => item[col] === r[col])
              );
            }
            if (existingIdx !== -1) {
              Object.assign(store[table][existingIdx], r);
            } else {
              store[table].push({ id: "id-" + Math.random(), ...r });
            }
          }
          return {
            select: () => ({
              single: async () => ({ data: store[table][store[table].length - 1], error: null }),
            }),
            single: async () => ({ data: store[table][store[table].length - 1], error: null }),
          };
        },
        update: (updates) => {
          const filter = {};
          const chain = {
            eq: (col, val) => {
              filter[col] = val;
              store[table].forEach((row) => {
                const matches = Object.entries(filter).every(([c, v]) => row[c] === v);
                if (matches) {
                  Object.assign(row, updates);
                }
              });
              return chain;
            },
            select: () => ({
              single: async () => {
                const matches = store[table].filter((row) =>
                  Object.entries(filter).every(([c, v]) => row[c] === v)
                );
                return { data: matches[0] || null, error: null };
              },
            }),
          };
          return chain;
        },
      };
    },
  };
}

test("remediation: vaultifyConfig secure credential vaulting", async () => {
  const db = makeMockDatabase();
  supabaseConfig.setMockAdminClient(db);

  const config = {
    shop_domain: "merchant.myshopify.com",
    access_token: "shpat_rawaccesskey",
  };

  const safeConfig = await vaultifyConfig("shopify", config, "org-123");

  assert.equal(safeConfig.shop_domain, "merchant.myshopify.com");
  assert.equal(safeConfig.access_token, "vault:integrations:shopify:access_token:org-123");
  assert.equal(db.store.vault["vault:integrations:shopify:access_token:org-123"], "shpat_rawaccesskey");

  supabaseConfig.setMockAdminClient(null);
});

test("remediation: createAgent ignores tools parameter to prevent database column errors", async () => {
  const db = makeMockDatabase();

  const agentData = {
    name: "Support Bot",
    provider: "elevenlabs",
    tools: [{ type: "web_search" }],
    prompt: "Talk friendly",
    model: "gemini-2.5-flash",
  };

  const agent = await agentService.createAgent(db, "org-123", agentData);
  assert.ok(agent);
  assert.equal(agent.name, "Support Bot");
  assert.equal(agent.persona.prompt, "Talk friendly");
  assert.equal(agent.persona.model, "gemini-2.5-flash");
  
  // Verify tools was NOT stored as a database table column in the insert
  assert.equal(db.store.agents[0].tools, undefined);
});

test("remediation: updateAgent ignores tools parameter to prevent update query crashes", async () => {
  const db = makeMockDatabase();
  db.store.agents.push({
    id: "agent-999",
    org_id: "org-123",
    name: "Old Support Bot",
    persona: { prompt: "Old prompt" },
    deleted_at: null,
  });

  const updateData = {
    name: "New Support Bot",
    tools: [{ type: "web_search" }],
  };

  const updatedAgent = await agentService.updateAgent(db, "org-123", "agent-999", updateData);
  assert.ok(updatedAgent);
  assert.equal(updatedAgent.name, "New Support Bot");
  
  // Verify tools was NOT stored in the database row
  assert.equal(db.store.agents[0].tools, undefined);
});

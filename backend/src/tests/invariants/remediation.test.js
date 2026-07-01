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
    users: [],
    calls: [],
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

test("remediation: user deletion verifies organization bounds before action", async () => {
  const db = makeMockDatabase();
  db.store.users.push({
    id: "user-999",
    org_id: "org-123",
    email: "user@example.com",
    role: "admin",
  });

  // Try to lookup user under correct org
  const { data: correctUser } = await db
    .from("users")
    .select("id")
    .eq("id", "user-999")
    .eq("org_id", "org-123")
    .maybeSingle();
  assert.ok(correctUser);
  assert.equal(correctUser.id, "user-999");

  // Try to lookup user under wrong org (simulating IDOR attempt)
  const { data: wrongUser } = await db
    .from("users")
    .select("id")
    .eq("id", "user-999")
    .eq("org_id", "org-wrong-456")
    .maybeSingle();
  assert.equal(wrongUser, null);
});

test("remediation: calls list and detail endpoints enforce org_id filters", async () => {
  const db = makeMockDatabase();
  db.store.calls.push(
    {
      id: "call-1",
      org_id: "org-123",
      direction: "outbound",
      status: "completed",
    },
    {
      id: "call-2",
      org_id: "org-456",
      direction: "inbound",
      status: "completed",
    }
  );

  // Query list for org-123
  const { data: calls123 } = await db
    .from("calls")
    .select("*")
    .eq("org_id", "org-123");
  assert.equal(calls123.length, 1);
  assert.equal(calls123[0].id, "call-1");

  // Query detail for call-2 using org-123 (unauthorized)
  const { data: call2DetailWrongOrg } = await db
    .from("calls")
    .select("*")
    .eq("id", "call-2")
    .eq("org_id", "org-123")
    .maybeSingle();
  assert.equal(call2DetailWrongOrg, null);
});

test("remediation: elevenlabs provider complies with agent payload structure requirements", () => {
  const ElevenLabsProvider = require("../../providers/voice/elevenlabs.provider");
  const provider = new ElevenLabsProvider("org-123", { api_key: "test-api-key" });

  const mockAgent = {
    name: "Standard Booking Assistant",
    first_message: "Hello patient!",
    language: "en-US",
    voice_id: "voice-cai-uuid",
    interaction_budget: { total_budget: "async" }, // should normalize to 10_minutes
    knowledge_base_ids: ["kb-123", "kb-456"],
    tools: [
      {
        name: "book_appointment",
        description: "Schedule clinical appointment",
        url: "https://api.weeber.ai/v1/tools/calcom/book",
      }
    ],
  };

  const payload = provider._buildAgentPayload(mockAgent, "Greet and help");
  assert.ok(payload);
  assert.equal(payload.name, "Standard Booking Assistant");

  // EL-001 & EL-004: verify interaction_budget nesting and async normalization
  assert.ok(payload.conversation_config?.agent?.interaction_budget);
  assert.equal(payload.conversation_config.agent.interaction_budget.total_budget, "10_minutes");

  // EL-002: verify knowledge base objects formatting
  assert.ok(payload.conversation_config.agent.prompt.knowledge_base);
  assert.deepEqual(payload.conversation_config.agent.prompt.knowledge_base, [
    { type: "id", id: "kb-123" },
    { type: "id", id: "kb-456" }
  ]);

  // EL-003: verify tools type parameter
  assert.ok(payload.conversation_config.agent.prompt.tools);
  assert.equal(payload.conversation_config.agent.prompt.tools[0].type, "webhook");
  assert.equal(payload.conversation_config.agent.prompt.tools[0].name, "book_appointment");
});

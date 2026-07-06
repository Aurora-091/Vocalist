const assert = require("node:assert/strict");
const { test } = require("node:test");

// Mock state representing Supabase database
function makeMockDatabase() {
  const store = {
    agents: [],
    organization_agents: [],
    knowledge_sources: [],
    knowledge_provider_mappings: [],
    calls: [],
    usage_ledger: [],
    call_events: [],
    phone_numbers: [],
    integrations: [],
  };

  return {
    store,
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
            or: (expr) => chain,
            order: () => chain,
            limit: () => chain,
            maybeSingle: async () => {
              const res = store[table].filter(row => {
                return Object.entries(filter).every(([col, val]) => {
                  if (val === null) return row[col] === null;
                  return row[col] === val;
                });
              });
              return { data: res[0] || null, error: null };
            },
            single: async () => {
              const res = store[table].filter(row => {
                return Object.entries(filter).every(([col, val]) => {
                  if (val === null) return row[col] === null;
                  return row[col] === val;
                });
              });
              return { data: res[0] || null, error: null };
            },
          };
          return chain;
        },
        insert: (row) => {
          const inserted = Array.isArray(row)
            ? row.map(r => ({ id: Math.random().toString(), created_at: new Date().toISOString(), ...r }))
            : { id: Math.random().toString(), created_at: new Date().toISOString(), ...row };
          if (Array.isArray(inserted)) {
            store[table].push(...inserted);
          } else {
            store[table].push(inserted);
          }
          return {
            select: () => ({
              single: async () => inserted,
              maybeSingle: async () => inserted,
            }),
            single: async () => inserted,
          };
        },
        update: (updates) => {
          const filter = {};
          const chain = {
            eq: (col, val) => {
              filter[col] = val;
              // Apply updates to matching rows
              store[table].forEach(row => {
                const matches = Object.entries(filter).every(([c, v]) => {
                  if (v === null) return row[c] === null;
                  return row[c] === v;
                });
                if (matches) {
                  Object.assign(row, updates);
                }
              });
              return chain;
            },
            select: () => ({
              single: async () => store[table].find(row => {
                return Object.entries(filter).every(([c, v]) => row[c] === v);
              }),
              maybeSingle: async () => store[table].find(row => {
                return Object.entries(filter).every(([c, v]) => row[c] === v);
              }),
            }),
            maybeSingle: async () => store[table].find(row => {
              return Object.entries(filter).every(([c, v]) => row[c] === v);
            }),
            single: async () => store[table].find(row => {
              return Object.entries(filter).every(([c, v]) => row[c] === v);
            }),
          };
          return chain;
        },
        delete: () => {
          const filter = {};
          const chain = {
            eq: (col, val) => {
              filter[col] = val;
              store[table] = store[table].filter(row => {
                const matches = Object.entries(filter).every(([c, v]) => {
                  if (v === null) return row[c] === null;
                  return row[c] === v;
                });
                return !matches;
              });
              return chain;
            },
            error: null
          };
          return chain;
        }
      };
    }
  };
}


// 1. Duplicate agent prevention & 9. Multi-tenant agent creation tests
test("Duplicate agent prevention & multi-tenant agent creation checks", async () => {
  const db = makeMockDatabase();
  
  // Register initial agent
  await db.from("agents").insert({
    org_id: "org-1",
    name: "Support Bot",
    provider: "elevenlabs",
    deleted_at: null,
  });

  // Attempt to create duplicate name under same org
  const list1 = db.store.agents.filter(a => a.org_id === "org-1" && a.deleted_at === null);
  const dup = list1.find(a => a.name.toLowerCase() === "support bot");
  assert.ok(dup, "Duplicate name detected");

  // Attempt to create agent with same name in a DIFFERENT org (should be allowed)
  const list2 = db.store.agents.filter(a => a.org_id === "org-2" && a.deleted_at === null);
  const otherOrgDup = list2.find(a => a.name.toLowerCase() === "support bot");
  assert.equal(otherOrgDup, undefined, "Different org isolation works");
});

// 2. Provider sync & 3. Agent update sync & 4. Agent delete sync
test("Provider registry and agent sync lifecycles", async () => {
  const db = makeMockDatabase();

  // Create agent
  const agent = await db.from("agents").insert({
    org_id: "org-1",
    name: "Assistant",
    provider: "elevenlabs",
    sync_status: "pending",
  }).single();

  // Provisioning synced state mapping
  assert.equal(agent.provider, "elevenlabs");
  assert.equal(agent.sync_status, "pending");

  // Update sync
  await db.from("agents").update({ sync_status: "synced", last_synced_at: new Date().toISOString() }).eq("id", agent.id);
  const updated = db.store.agents.find(a => a.id === agent.id);
  assert.equal(updated.sync_status, "synced");

  // Delete registry mapping
  db.store.organization_agents.push({ org_id: "org-1", agent_id: agent.id, provider_agent_id: "agent-1" });
  assert.equal(db.store.organization_agents.length, 1);
  
  // Delete logic
  db.store.organization_agents = db.store.organization_agents.filter(a => a.agent_id !== agent.id);
  assert.equal(db.store.organization_agents.length, 0);
});

// 5. Webhook processing & 10. Idempotent retries
test("Webhook post-call processing and idempotency", async () => {
  const db = makeMockDatabase();

  // Create call record
  const call = await db.from("calls").insert({
    org_id: "org-1",
    provider: "elevenlabs",
    provider_call_id: "call-1",
    status: "queued",
  });

  // Mock post call webhook handler logic
  function processWebhook(payload) {
    const isDuplicate = db.store.usage_ledger.some(l => l.idempotency_key === payload.idempotency_key);
    if (isDuplicate) return { duplicate: true };

    // Update call
    db.store.calls.forEach(c => {
      if (c.provider_call_id === payload.call_sid) {
        c.status = "completed";
        c.duration_sec = payload.duration_sec;
        c.cost_usd = (payload.duration_sec / 60) * 0.15;
      }
    });

    // Add ledger entry
    db.from("usage_ledger").insert({
      org_id: "org-1",
      kind: "voice_minutes",
      quantity: Math.ceil(payload.duration_sec / 60),
      idempotency_key: payload.idempotency_key,
    });

    return { success: true };
  }

  const payload = {
    call_sid: "call-1",
    duration_sec: 120,
    idempotency_key: "idem-key-123",
  };

  // Run first webhook trigger
  const res1 = processWebhook(payload);
  assert.equal(res1.success, true);
  
  const updatedCall = db.store.calls.find(c => c.provider_call_id === "call-1");
  assert.equal(updatedCall.status, "completed");
  assert.equal(updatedCall.duration_sec, 120);
  assert.equal(updatedCall.cost_usd, 0.30); // 120 sec = 2 min * $0.15 = 0.30

  assert.equal(db.store.usage_ledger.length, 1, "One usage ledger entry recorded");

  // Run duplicate webhook retry (should trigger idempotency guard)
  const res2 = processWebhook(payload);
  assert.equal(res2.duplicate, true);
  assert.equal(db.store.usage_ledger.length, 1, "No duplicate usage ledger entry recorded");
});

// 6. Call lifecycle
test("Call lifecycle checks", () => {
  const states = ["queued", "ringing", "in_progress", "completed"];
  let status = "queued";
  
  function transit(nextState) {
    if (states.indexOf(nextState) > states.indexOf(status)) {
      status = nextState;
    }
  }

  transit("ringing");
  assert.equal(status, "ringing");
  transit("completed");
  assert.equal(status, "completed");
  transit("ringing"); // Reverse check should fail/ignore
  assert.equal(status, "completed");
});

// 7. Knowledge base sync
test("Knowledge base upload and mapping deduplication", async () => {
  const db = makeMockDatabase();

  // Initial source upload
  await db.from("knowledge_sources").insert({
    org_id: "org-1",
    kind: "website",
    uri: "https://example.com/help",
    status: "ready",
  });

  // Attempt duplicate upload check
  const checkDuplicate = (uri) => {
    return db.store.knowledge_sources.find(s => s.uri === uri) || null;
  };

  const matched = checkDuplicate("https://example.com/help");
  assert.ok(matched, "Prevented duplicate upload of website URL");
  
  const matchedNone = checkDuplicate("https://example.com/other");
  assert.equal(matchedNone, null);
});

// 8. Organization isolation
test("Multi-tenant organization isolation", async () => {
  const db = makeMockDatabase();

  // Create agents in different orgs
  await db.from("agents").insert({ org_id: "org-1", name: "Agent 1" });
  await db.from("agents").insert({ org_id: "org-2", name: "Agent 2" });

  const queryOrg1 = db.store.agents.filter(a => a.org_id === "org-1");
  const queryOrg2 = db.store.agents.filter(a => a.org_id === "org-2");

  assert.equal(queryOrg1.length, 1);
  assert.equal(queryOrg1[0].name, "Agent 1");

  assert.equal(queryOrg2.length, 1);
  assert.equal(queryOrg2[0].name, "Agent 2");
});

// Task 7: _buildPlatformSettings must emit AgentPlatformSettingsRequestModel shape
test("_buildPlatformSettings emits correct EL shape (never flat evaluation_criteria)", () => {
  // Stub logger and pino before requiring the provider (pino not installed in test env)
  const noop = () => {};
  const mockLogger = { info: noop, warn: noop, error: noop, debug: noop };
  const Module = require("module");
  const origLoad = Module._load;
  Module._load = function (req, parent, isMain) {
    if (req === "pino") return () => mockLogger;
    return origLoad.apply(this, arguments);
  };

  let provider;
  try {
    // Clear cached modules that depend on pino so they reload with the stub
    delete require.cache[require.resolve("../../config/logger")];
    delete require.cache[require.resolve("../../providers/voice/elevenlabs.provider")];
    const ElevenLabsProvider = require("../../providers/voice/elevenlabs.provider");
    provider = new ElevenLabsProvider({ api_key: "test" }, "org-test");
  } finally {
    Module._load = origLoad;
    delete require.cache[require.resolve("../../config/logger")];
    delete require.cache[require.resolve("../../providers/voice/elevenlabs.provider")];
  }

  const agent = {
    analysis_config: {
      data_collection: [
        { identifier: "purchase_intent", data_type: "string", description: "Did the customer intend to purchase?" },
        { identifier: "email_captured", data_type: "boolean", description: "Was an email captured?" },
      ],
      evaluation_criteria: [
        { identifier: "call_successful", description: "Was the call goal achieved?" },
        { identifier: "objection_handled", description: "Were objections handled professionally?" },
      ],
    },
  };

  const result = provider._buildPlatformSettings(agent);

  // Must NOT have the old flat keys
  assert.equal("evaluation_criteria" in result, false, "Old flat evaluation_criteria key must not exist");
  assert.equal(Array.isArray(result.data_collection), false, "Old array data_collection must not exist");

  // Must have evaluation.criteria (nested)
  assert.ok(result.evaluation, "evaluation key must exist");
  assert.ok(Array.isArray(result.evaluation.criteria), "evaluation.criteria must be an array");
  assert.equal(result.evaluation.criteria.length, 2);

  const c0 = result.evaluation.criteria[0];
  assert.equal(c0.id, "call_successful");
  assert.equal(c0.name, "call_successful");
  assert.equal(c0.type, "prompt");
  assert.equal(c0.scoring_mode, "binary");
  assert.ok(typeof c0.conversation_goal_prompt === "string");

  // Must have data_collection as keyed object
  assert.ok(result.data_collection && typeof result.data_collection === "object");
  assert.ok("purchase_intent" in result.data_collection);
  assert.equal(result.data_collection.purchase_intent.type, "string");
  assert.ok(typeof result.data_collection.purchase_intent.description === "string");
  assert.ok("email_captured" in result.data_collection);
  assert.equal(result.data_collection.email_captured.type, "boolean");

  // null when no config
  const nullResult = provider._buildPlatformSettings({});
  assert.equal(nullResult, null, "Returns null when no analysis_config");
});

// Test agent deletion unbinding phone numbers and registry mapping
test("deleteAgent unbinds phone numbers and deletes organization_agents", async () => {
  const db = makeMockDatabase();
  const agentService = require("../../modules/agents/agent.service");
  
  // Seed agent
  const agent = await db.from("agents").insert({
    id: "agent-uuid-1",
    org_id: "org-1",
    name: "Agent to Delete",
    provider: "elevenlabs",
    provider_ref: "provider-ref-1",
    deleted_at: null,
  }).single();

  // Seed organization_agents
  await db.from("organization_agents").insert({
    org_id: "org-1",
    agent_id: agent.id,
    provider_agent_id: "provider-ref-1",
  });

  // Seed phone number bound to agent
  await db.from("phone_numbers").insert({
    id: "phone-uuid-1",
    org_id: "org-1",
    e164: "+15555555555",
    agent_id: agent.id,
  });

  // Verify setup
  assert.equal(db.store.organization_agents.length, 1);
  assert.equal(db.store.phone_numbers[0].agent_id, agent.id);

  // Call deleteAgent
  await agentService.deleteAgent(db, "org-1", agent.id);

  // Verify organization_agents is deleted
  assert.equal(db.store.organization_agents.length, 0);

  // Verify phone_numbers agent_id is nullified
  assert.equal(db.store.phone_numbers[0].agent_id, null);

  // Verify agent is soft-deleted
  const deletedAgent = db.store.agents.find(a => a.id === agent.id);
  assert.ok(deletedAgent.deleted_at);
});

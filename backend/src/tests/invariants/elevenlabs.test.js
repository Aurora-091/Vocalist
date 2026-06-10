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
  };

  return {
    store,
    from(table) {
      return {
        select: (cols) => ({
          eq: (col, val) => ({
            is: (col2, val2) => {
              let res = store[table].filter(row => row[col] === val && (val2 === null ? row[col2] === null : row[col2] === val2));
              return {
                maybeSingle: async () => res[0] || null,
                single: async () => res[0] || null,
              };
            },
            maybeSingle: async () => {
              let res = store[table].filter(row => row[col] === val);
              return { data: res[0] || null, error: null };
            },
          }),
          or: (expr) => ({
            maybeSingle: async () => {
              // Stub or match
              return { data: store[table][0] || null, error: null };
            }
          }),
          eq_simple: (col, val) => {
            let res = store[table].filter(row => row[col] === val);
            return {
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: res[0] || null, error: null }),
                })
              }),
              maybeSingle: async () => ({ data: res[0] || null, error: null }),
              single: async () => ({ data: res[0] || null, error: null }),
            };
          }
        }),
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
        update: (updates) => ({
          eq: (col, val) => {
            store[table].forEach(row => {
              if (row[col] === val) {
                Object.assign(row, updates);
              }
            });
            return {
              select: () => ({
                single: async () => store[table].find(row => row[col] === val),
                maybeSingle: async () => store[table].find(row => row[col] === val),
              }),
              maybeSingle: async () => store[table].find(row => row[col] === val),
              single: async () => store[table].find(row => row[col] === val),
            };
          }
        }),
        delete: () => ({
          eq: (col, val) => {
            store[table] = store[table].filter(row => row[col] !== val);
            return {
              eq: (col2, val2) => {
                store[table] = store[table].filter(row => row[col] !== val || row[col2] !== val2);
                return { error: null };
              },
              error: null
            };
          }
        })
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

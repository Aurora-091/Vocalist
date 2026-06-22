const assert = require("node:assert/strict");
const { test } = require("node:test");

const STEPS = [
  "pick_vertical",
  "connect_tools",
  "add_knowledge",
  "create_agent",
  "get_number",
  "test_and_golive",
];

test("onboarding bootstraps with all steps false", () => {
  const o = bootstrap();
  for (const s of STEPS) assert.equal(o[s], false);
});

test("onboarding marks individual step done without touching others", () => {
  let o = bootstrap();
  o = patch(o, { create_agent: true });
  assert.equal(o.create_agent, true);
  assert.equal(o.pick_vertical, false);
});

test("onboarding marks completed when all steps true", () => {
  let o = bootstrap();
  for (const s of STEPS) o = patch(o, { [s]: true });
  assert.equal(allDone(o), true);
});

test("onboarding step keys are immutable allow-list", () => {
  const o = bootstrap();
  const out = patch(o, { not_a_real_step: true });
  assert.ok(!("not_a_real_step" in out));
});

function bootstrap() {
  return Object.fromEntries(STEPS.map((s) => [s, false]));
}
function patch(state, updates) {
  const next = { ...state };
  for (const [k, v] of Object.entries(updates)) {
    if (STEPS.includes(k)) next[k] = !!v;
  }
  return next;
}
function allDone(state) {
  return STEPS.every((s) => state[s] === true);
}

const { updateOnboardingStep } = require("../../modules/onboarding/onboarding.routes");

test("updateOnboardingStep helper fetches, merges, and upserts steps", async () => {
  let upsertedData = null;
  const mockState = {
    steps: { pick_vertical: true, connect_tools: false }
  };
  
  const mockSupabase = {
    from: (table) => {
      assert.equal(table, "onboarding_state");
      return {
        select: (fields) => {
          assert.equal(fields, "steps");
          return {
            eq: (key, val) => {
              assert.equal(key, "org_id");
              assert.equal(val, "test-org-123");
              return {
                maybeSingle: async () => ({ data: mockState, error: null })
              };
            }
          };
        },
        upsert: async (payload) => {
          upsertedData = payload;
          return { error: null };
        }
      };
    }
  };

  await updateOnboardingStep(mockSupabase, "test-org-123", "connect_tools", true);

  assert.ok(upsertedData);
  assert.equal(upsertedData.org_id, "test-org-123");
  assert.equal(upsertedData.steps.pick_vertical, true);
  assert.equal(upsertedData.steps.connect_tools, true);
  assert.ok(upsertedData.updated_at);
  assert.equal(upsertedData.completed_at, undefined); // not all done
});

test("updateOnboardingStep sets completed_at if all steps are true", async () => {
  let upsertedData = null;
  // all steps true except one we are about to update
  const mockState = {
    steps: {
      pick_vertical: true,
      connect_tools: true,
      add_knowledge: true,
      create_agent: true,
      get_number: true,
      test_and_golive: false
    }
  };

  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mockState, error: null })
        })
      }),
      upsert: async (payload) => {
        upsertedData = payload;
        return { error: null };
      }
    })
  };

  await updateOnboardingStep(mockSupabase, "test-org-123", "test_and_golive", true);

  assert.ok(upsertedData);
  assert.equal(upsertedData.steps.test_and_golive, true);
  assert.ok(upsertedData.completed_at, "completed_at should be defined when all steps are true");
});

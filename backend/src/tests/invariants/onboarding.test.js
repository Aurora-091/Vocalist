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

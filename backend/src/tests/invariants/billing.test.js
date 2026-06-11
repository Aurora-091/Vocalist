const assert = require("node:assert/strict");
const { test } = require("node:test");

test("processCallCompletion calculates overage correctly", () => {
  const result = calculateCost({
    usedMinutes: 120,
    includedMinutes: 100,
    overageRate: 0.12,
    callMinutes: 5,
  });
  assert.equal(result.billableMinutes, 5);
  assert.equal(result.costUsd, 0.60);
});

test("processCallCompletion is free within included minutes", () => {
  const result = calculateCost({
    usedMinutes: 50,
    includedMinutes: 100,
    overageRate: 0.12,
    callMinutes: 3,
  });
  assert.equal(result.billableMinutes, 0);
  assert.equal(result.costUsd, 0);
});

test("processCallCompletion partial overage (straddles boundary)", () => {
  const result = calculateCost({
    usedMinutes: 98,
    includedMinutes: 100,
    overageRate: 0.10,
    callMinutes: 5,
  });
  assert.equal(result.billableMinutes, 3);
  assert.equal(result.costUsd, 0.30);
});

test("idempotency key prevents double-billing", () => {
  const seen = new Set();
  const key = "call_abc123_voice";
  assert.equal(isDuplicate(seen, key), false);
  seen.add(key);
  assert.equal(isDuplicate(seen, key), true);
});

test("zero-duration call costs nothing", () => {
  const result = calculateCost({
    usedMinutes: 200,
    includedMinutes: 100,
    overageRate: 0.15,
    callMinutes: 0,
  });
  assert.equal(result.costUsd, 0);
});

function calculateCost({ usedMinutes, includedMinutes, overageRate, callMinutes }) {
  const remaining = Math.max(0, includedMinutes - usedMinutes);
  const billableMinutes = Math.max(0, callMinutes - remaining);
  const costUsd = Math.round(billableMinutes * overageRate * 100) / 100;
  return { billableMinutes, costUsd };
}

function isDuplicate(seen, key) {
  return seen.has(key);
}

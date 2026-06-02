const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildIdempotencyKey } = require("../../utils/idempotency");

test("idempotency key is deterministic for same inputs", () => {
  const a = buildIdempotencyKey(["vapi", "call_123", "voice_minutes"]);
  const b = buildIdempotencyKey(["vapi", "call_123", "voice_minutes"]);
  assert.equal(a, b);
});

test("idempotency key differs for different inputs", () => {
  const a = buildIdempotencyKey(["vapi", "call_123", "voice_minutes"]);
  const b = buildIdempotencyKey(["vapi", "call_124", "voice_minutes"]);
  assert.notEqual(a, b);
});

test("idempotency key differs by metric kind", () => {
  const a = buildIdempotencyKey(["vapi", "call_123", "voice_minutes"]);
  const b = buildIdempotencyKey(["vapi", "call_123", "campaign_call"]);
  assert.notEqual(a, b);
});

test("idempotency key ignores empty parts", () => {
  const a = buildIdempotencyKey(["vapi", null, "call_123", undefined, "voice_minutes"]);
  const b = buildIdempotencyKey(["vapi", "call_123", "voice_minutes"]);
  assert.equal(a, b);
});

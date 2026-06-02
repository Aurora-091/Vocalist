const assert = require("node:assert/strict");
const { test } = require("node:test");
const { hmacSha256, verifyHmacSha256, verifyVapiSignature, verifyTwilioSignature } = require("../../utils/signature");

test("HMAC SHA256 produces consistent output", () => {
  const sig = hmacSha256("secret", "payload");
  assert.equal(typeof sig, "string");
  assert.equal(sig.length, 64);
});

test("verifyHmacSha256 accepts correct signatures", () => {
  const payload = JSON.stringify({ event: "test", data: { id: 1 } });
  const sig = hmacSha256("test-secret", payload);
  assert.equal(verifyHmacSha256("test-secret", payload, sig), true);
});

test("verifyHmacSha256 rejects tampered payloads", () => {
  const payload = JSON.stringify({ event: "test" });
  const sig = hmacSha256("test-secret", payload);
  const tampered = JSON.stringify({ event: "test", evil: true });
  assert.equal(verifyHmacSha256("test-secret", tampered, sig), false);
});

test("verifyHmacSha256 rejects wrong secret", () => {
  const payload = "x";
  const sig = hmacSha256("a", payload);
  assert.equal(verifyHmacSha256("b", payload, sig), false);
});

test("verifyVapiSignature requires secret in production-like flow", () => {
  const payload = "{}";
  const sig = hmacSha256("vapi-secret", payload);
  assert.equal(verifyVapiSignature("vapi-secret", payload, sig), true);
  assert.equal(verifyVapiSignature("vapi-secret", payload, "deadbeef"), false);
});

test("verifyTwilioSignature returns false for wrong signature", () => {
  const params = { CallSid: "CA123", CallStatus: "completed" };
  assert.equal(
    verifyTwilioSignature("token", "https://example.com/webhooks/twilio", params, "wrong"),
    false
  );
});

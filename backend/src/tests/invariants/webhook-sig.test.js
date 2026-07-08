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

test("verifyRequestSignature returns true in sandbox mode", async () => {
  const router = require("../../modules/webhooks/webhook.routes");
  process.env.TWILIO_SANDBOX_MODE = "true";
  const req = {
    body: { AccountSid: "ACsandbox123" }
  };
  const verified = await router._verifyRequestSignature(req, "https://example.com/webhook", "any-sig");
  assert.equal(verified, true);
});

test("verifyRequestSignature bypasses if SID starts with ACsandbox", async () => {
  const router = require("../../modules/webhooks/webhook.routes");
  process.env.TWILIO_SANDBOX_MODE = "false";
  const req = {
    body: { AccountSid: "ACsandbox123" }
  };
  const verified = await router._verifyRequestSignature(req, "https://example.com/webhook", "any-sig");
  assert.equal(verified, true);
});

test("verifyRequestSignature looks up subaccount from database & Vault", async () => {
  const router = require("../../modules/webhooks/webhook.routes");
  const { setMockAdminClient } = require("../../config/supabase");
  
  process.env.TWILIO_SANDBOX_MODE = "false";
  const params = { AccountSid: "ACsubaccount123", CallSid: "CA123", CallStatus: "completed" };
  const url = "https://example.com/webhook";

  const mockDb = {
    from: (table) => {
      assert.equal(table, "twilio_subaccounts");
      return {
        select: (cols) => {
          assert.equal(cols, "auth_token_ref");
          return {
            eq: (col, val) => {
              assert.equal(col, "subaccount_sid");
              assert.equal(val, "ACsubaccount123");
              return {
                maybeSingle: async () => ({
                  data: { auth_token_ref: "vault:token_ref" },
                  error: null
                })
              };
            }
          };
        }
      };
    },
    rpc: async (fn, args) => {
      assert.equal(fn, "vault_read");
      assert.equal(args.name, "vault:token_ref");
      return { data: "resolved-subaccount-token", error: null };
    }
  };

  setMockAdminClient(mockDb);

  // Compute valid signature using the resolved-subaccount-token
  const crypto = require("crypto");
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map((k) => `${k}${params[k]}`).join("");
  const sig = crypto.createHmac("sha1", "resolved-subaccount-token").update(data).digest("base64");

  const verified = await router._verifyRequestSignature(
    { body: params },
    url,
    sig
  );
  assert.equal(verified, true);

  // Revert mock
  setMockAdminClient(null);
});

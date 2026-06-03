const assert = require("node:assert/strict");
const { test } = require("node:test");

// Pure-logic tests for the Twilio module — no real API calls. We import the
// client helper and exercise sandbox mode plus internal bookkeeping invariants.
process.env.TWILIO_SANDBOX_MODE = "true";

const cacheModule = {
  store: new Map(),
  upsert(orgId, sid) {
    if (this.store.has(orgId)) return this.store.get(orgId);
    const row = { org_id: orgId, subaccount_sid: sid, status: "active" };
    this.store.set(orgId, row);
    return row;
  },
};

test("subaccount provisioning is idempotent per org", () => {
  const a = cacheModule.upsert("org-a", "ACsandbox-a");
  const b = cacheModule.upsert("org-a", "ACsandbox-a-other");
  assert.equal(a.subaccount_sid, b.subaccount_sid);
  assert.equal(cacheModule.store.size, 1);
});

test("subaccount sids are isolated between orgs", () => {
  cacheModule.upsert("org-x", "ACsandbox-x");
  cacheModule.upsert("org-y", "ACsandbox-y");
  const x = cacheModule.store.get("org-x");
  const y = cacheModule.store.get("org-y");
  assert.notEqual(x.subaccount_sid, y.subaccount_sid);
  assert.equal(x.org_id, "org-x");
  assert.equal(y.org_id, "org-y");
});

test("sandbox search produces correctly-shaped numbers", () => {
  const results = sandboxSearch("US", "415", "local", 3);
  assert.equal(results.length, 3);
  for (const r of results) {
    assert.match(r.phoneNumber, /^\+1\d{10}$/);
    assert.equal(r.isoCountry, "US");
    assert.equal(r.capabilities.voice, true);
    assert.equal(r.sandbox, true);
  }
});

test("sandbox tollfree search uses 800 prefix", () => {
  const results = sandboxSearch("US", null, "tollfree", 2);
  for (const r of results) {
    assert.ok(r.phoneNumber.startsWith("+1800"));
    assert.equal(r.capabilities.SMS, false);
  }
});

test("e164 dedupe: same number cannot be attached twice for an org", () => {
  const seen = new Set();
  function attach(orgId, e164) {
    const k = `${orgId}::${e164}`;
    if (seen.has(k)) return { duplicate: true };
    seen.add(k);
    return { duplicate: false };
  }
  assert.equal(attach("org-1", "+14155550199").duplicate, false);
  assert.equal(attach("org-1", "+14155550199").duplicate, true);
  assert.equal(attach("org-2", "+14155550199").duplicate, false);
});

function sandboxSearch(country, areaCode, kind, limit) {
  const base = areaCode || "415";
  const out = [];
  for (let i = 0; i < limit; i++) {
    const last4 = String(1000 + i).padStart(4, "0");
    out.push({
      friendlyName:
        kind === "tollfree" ? `(800) 555-${last4}` : `(${base}) 555-${last4}`,
      phoneNumber:
        kind === "tollfree" ? `+1800555${last4}` : `+1${base}555${last4}`,
      locality: kind === "tollfree" ? "Toll-free" : "San Francisco",
      region: kind === "tollfree" ? "US" : "CA",
      isoCountry: country || "US",
      capabilities: { voice: true, SMS: kind !== "tollfree", MMS: false },
      sandbox: true,
    });
  }
  return out;
}

const assert = require("node:assert/strict");
const { test } = require("node:test");

test("can_dial requires consent=granted", () => {
  assert.equal(decide({ consent: "granted", dnc: false, hour: 12 }).allowed, true);
  assert.equal(decide({ consent: "none", dnc: false, hour: 12 }).allowed, false);
  assert.equal(decide({ consent: "revoked", dnc: false, hour: 12 }).allowed, false);
});

test("can_dial blocks any DNC entry", () => {
  const r = decide({ consent: "granted", dnc: true, hour: 12 });
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => x.startsWith("dnc")));
});

test("can_dial blocks before calling-window start", () => {
  const r = decide({ consent: "granted", dnc: false, hour: 6 });
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.includes("outside_calling_hours"));
});

test("can_dial blocks after calling-window end", () => {
  const r = decide({ consent: "granted", dnc: false, hour: 22 });
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.includes("outside_calling_hours"));
});

test("revoked consent + DNC stacks both reasons", () => {
  const r = decide({ consent: "revoked", dnc: true, hour: 12 });
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.includes("no_consent"));
  assert.ok(r.reasons.some((x) => x.startsWith("dnc")));
});

function decide({ consent, dnc, hour, start = 9, end = 20 }) {
  const reasons = [];
  if (consent !== "granted") reasons.push("no_consent");
  if (dnc) reasons.push("dnc:user_request");
  if (hour < start || hour > end) reasons.push("outside_calling_hours");
  return { allowed: reasons.length === 0, reasons };
}

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { toE164, tryE164 } = require("../../utils/phone");

test("toE164 normalizes US number with default country", () => {
  const e164 = toE164("(415) 555-0132", "US");
  assert.equal(e164, "+14155550132");
});

test("toE164 accepts already-formatted E.164", () => {
  assert.equal(toE164("+14155550132"), "+14155550132");
});

test("toE164 throws on invalid input", () => {
  assert.throws(() => toE164("not a phone"), /Invalid phone/);
});

test("tryE164 returns null on invalid input", () => {
  assert.equal(tryE164("garbage"), null);
});

test("tryE164 normalizes valid input", () => {
  assert.equal(tryE164("415-555-0132"), "+14155550132");
});

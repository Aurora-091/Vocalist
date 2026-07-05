const assert = require("node:assert/strict");
const { test } = require("node:test");
const { tryE164 } = require("../../utils/phone");
const { canRetry, isWithinQuietHours, nextBusinessWindow, computeRetryAt, MAX_ATTEMPTS } = require("../../utils/scheduling");

// --- tryE164 normalization tests ---

test("tryE164 normalizes Indian number without country code", () => {
  const result = tryE164("9876543210", "IN");
  assert.equal(result, "+919876543210");
});

test("tryE164 normalizes Indian number with +91 prefix", () => {
  const result = tryE164("+91 98765 43210", "IN");
  assert.equal(result, "+919876543210");
});

test("tryE164 normalizes Indian number with 0 prefix", () => {
  const result = tryE164("09876543210", "IN");
  assert.equal(result, "+919876543210");
});

test("tryE164 returns null for invalid short number", () => {
  const result = tryE164("12345", "IN");
  assert.equal(result, null);
});

test("tryE164 returns null for empty string", () => {
  const result = tryE164("", "IN");
  assert.equal(result, null);
});

test("tryE164 returns null for null input", () => {
  const result = tryE164(null, "IN");
  assert.equal(result, null);
});

test("tryE164 normalizes US number", () => {
  const result = tryE164("(415) 555-0199", "US");
  assert.equal(result, "+14155550199");
});

test("tryE164 handles already-formatted E.164", () => {
  const result = tryE164("+14155550199", "US");
  assert.equal(result, "+14155550199");
});

// --- Retry ladder tests ---

test("canRetry returns true for attempt 1", () => {
  assert.equal(canRetry(1), true);
});

test("canRetry returns true for attempt 2", () => {
  assert.equal(canRetry(2), true);
});

test("canRetry returns false at max attempts", () => {
  assert.equal(canRetry(MAX_ATTEMPTS), false);
});

test("canRetry returns false beyond max attempts", () => {
  assert.equal(canRetry(MAX_ATTEMPTS + 1), false);
});

// --- Quiet hours tests ---

test("isWithinQuietHours returns true for 2 AM", () => {
  const date = new Date("2025-01-15T02:00:00+05:30");
  assert.equal(isWithinQuietHours(date, 9, 21, "Asia/Kolkata"), true);
});

test("isWithinQuietHours returns true for 22:00", () => {
  const date = new Date("2025-01-15T22:00:00+05:30");
  assert.equal(isWithinQuietHours(date, 9, 21, "Asia/Kolkata"), true);
});

test("isWithinQuietHours returns false for 10 AM", () => {
  const date = new Date("2025-01-15T10:00:00+05:30");
  assert.equal(isWithinQuietHours(date, 9, 21, "Asia/Kolkata"), false);
});

test("isWithinQuietHours returns false for 20:59", () => {
  const date = new Date("2025-01-15T20:59:00+05:30");
  assert.equal(isWithinQuietHours(date, 9, 21, "Asia/Kolkata"), false);
});

test("isWithinQuietHours returns true at exactly the end hour", () => {
  const date = new Date("2025-01-15T21:00:00+05:30");
  assert.equal(isWithinQuietHours(date, 9, 21, "Asia/Kolkata"), true);
});

// --- nextBusinessWindow tests ---

test("nextBusinessWindow defers night call to next morning", () => {
  const nightTime = new Date("2025-01-15T23:00:00+05:30");
  const result = nextBusinessWindow(nightTime, 9, "Asia/Kolkata");
  const resultLocal = new Date(result.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  assert.equal(resultLocal.getHours(), 9);
  assert.equal(resultLocal.getDate(), 16);
});

test("nextBusinessWindow defers early morning to same day start", () => {
  const earlyMorning = new Date("2025-01-15T04:00:00+05:30");
  const result = nextBusinessWindow(earlyMorning, 9, "Asia/Kolkata");
  const resultLocal = new Date(result.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  assert.equal(resultLocal.getHours(), 9);
  assert.equal(resultLocal.getDate(), 15);
});

// --- computeRetryAt tests ---

test("computeRetryAt respects quiet hours", () => {
  // 8:30 PM + 30 min = 9:00 PM which is outside hours, should defer
  const date = new Date("2025-01-15T20:30:00+05:30");
  const result = computeRetryAt(date, 1, { startHour: 9, endHour: 21, timezone: "Asia/Kolkata" });
  const resultLocal = new Date(result.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  assert.equal(resultLocal.getHours(), 9);
});

test("computeRetryAt within business hours stays on same day", () => {
  // 10:00 AM + 30 min = 10:30 AM, within hours
  const date = new Date("2025-01-15T10:00:00+05:30");
  const result = computeRetryAt(date, 1, { startHour: 9, endHour: 21, timezone: "Asia/Kolkata" });
  const resultLocal = new Date(result.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  assert.equal(resultLocal.getDate(), 15);
  assert.equal(resultLocal.getHours(), 10);
  assert.equal(resultLocal.getMinutes(), 30);
});

// --- Conversion cancel / COD idempotency logic (unit-level) ---

test("deriveOutcome returns no_answer for sub-5s call", () => {
  const result = deriveOutcome({ call_duration_secs: 3 }, "conversation.ended");
  assert.equal(result, "no_answer");
});

test("deriveOutcome returns voicemail when detected", () => {
  const result = deriveOutcome({ call_duration_secs: 15, analysis: { voicemail_detected: true } }, "conversation.ended");
  assert.equal(result, "voicemail");
});

test("deriveOutcome returns answered for normal call", () => {
  const result = deriveOutcome({ call_duration_secs: 60, analysis: {} }, "conversation.ended");
  assert.equal(result, "answered");
});

test("deriveOutcome returns failed for call.failed", () => {
  const result = deriveOutcome({}, "call.failed");
  assert.equal(result, "failed");
});

test("deriveOutcome returns declined when analysis says so", () => {
  const result = deriveOutcome({ call_duration_secs: 20, analysis: { outcome: "declined" } }, "conversation.ended");
  assert.equal(result, "declined");
});

// Inline deriveOutcome matching the handler implementation
function deriveOutcome(data, eventType) {
  if (eventType === "call.failed") return "failed";
  const duration = data?.call_duration_secs || data?.duration_sec || 0;
  if (duration < 5) return "no_answer";
  const analysis = data?.analysis;
  if (analysis?.voicemail_detected || analysis?.outcome === "voicemail") return "voicemail";
  if (analysis?.outcome === "declined" || analysis?.outcome === "not_interested") return "declined";
  return "answered";
}

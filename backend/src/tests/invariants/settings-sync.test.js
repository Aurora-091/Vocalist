const assert = require("node:assert/strict");
const { test } = require("node:test");

// Simulates the mapping logic inside settings.routes.js
function mapGetNotificationPrefs(email, in_app) {
  return {
    usage_alerts: email.billing !== false,
    failed_calls: email.missed_call !== false,
    campaign_completed: email.campaign_done !== false,
  };
}

function mapPutNotificationPrefs(body) {
  const { usage_alerts, failed_calls, campaign_completed } = body;
  const email = {
    billing: usage_alerts !== false,
    missed_call: failed_calls !== false,
    campaign_done: campaign_completed !== false,
    voicemail: true,
    integration_broken: true,
  };
  const in_app = {
    billing: usage_alerts !== false,
    missed_call: failed_calls !== false,
    campaign_done: campaign_completed !== false,
    voicemail: true,
    integration_broken: true,
  };
  return { email, in_app };
}

test("notification-prefs: returns all true by default", () => {
  const email = {};
  const in_app = {};
  const prefs = mapGetNotificationPrefs(email, in_app);
  assert.equal(prefs.usage_alerts, true);
  assert.equal(prefs.failed_calls, true);
  assert.equal(prefs.campaign_completed, true);
});

test("notification-prefs: parses false values correctly", () => {
  const email = { billing: false, missed_call: false, campaign_done: false };
  const in_app = {};
  const prefs = mapGetNotificationPrefs(email, in_app);
  assert.equal(prefs.usage_alerts, false);
  assert.equal(prefs.failed_calls, false);
  assert.equal(prefs.campaign_completed, false);
});

test("notification-prefs: formats PUT request to DB JSONB format", () => {
  const body = { usage_alerts: false, failed_calls: true, campaign_completed: false };
  const { email, in_app } = mapPutNotificationPrefs(body);
  
  assert.equal(email.billing, false);
  assert.equal(email.missed_call, true);
  assert.equal(email.campaign_done, false);
  assert.equal(email.voicemail, true);
  
  assert.equal(in_app.billing, false);
  assert.equal(in_app.missed_call, true);
  assert.equal(in_app.campaign_done, false);
  assert.equal(in_app.voicemail, true);
});

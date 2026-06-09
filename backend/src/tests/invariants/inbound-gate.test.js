const assert = require("node:assert/strict");
const { test } = require("node:test");

// Simulates the admission gate check logic
function checkAdmissionGate({ rateStatus, allowedToSpend }) {
  if (rateStatus === "blocked_rate") {
    return {
      status: "blocked_rate",
      xml: "<Response><Say>We are experiencing a high volume of calls.</Say><Hangup/></Response>"
    };
  }

  if (!allowedToSpend) {
    return {
      status: "blocked_spend",
      xml: "<Response><Say>The service limit has been reached.</Say><Hangup/></Response>"
    };
  }

  return {
    status: "admit",
    xml: "<Response><Connect><Stream url=\"wss://test-host/v1/twilio/stream/test-call-id\" /></Connect></Response>"
  };
}

test("inbound-gate: admits calls under normal conditions", () => {
  const result = checkAdmissionGate({ rateStatus: "admit", allowedToSpend: true });
  assert.equal(result.status, "admit");
  assert.match(result.xml, /<Stream/);
});

test("inbound-gate: blocks calls if rate limit hit", () => {
  const result = checkAdmissionGate({ rateStatus: "blocked_rate", allowedToSpend: true });
  assert.equal(result.status, "blocked_rate");
  assert.match(result.xml, /high volume/);
  assert.ok(!result.xml.includes("<Stream"));
});

test("inbound-gate: blocks calls if spend guard hit", () => {
  const result = checkAdmissionGate({ rateStatus: "admit", allowedToSpend: false });
  assert.equal(result.status, "blocked_spend");
  assert.match(result.xml, /service limit/);
  assert.ok(!result.xml.includes("<Stream"));
});

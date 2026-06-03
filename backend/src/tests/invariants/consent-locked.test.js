const assert = require("node:assert/strict");
const { test } = require("node:test");

test("force-outbound-consent: outbound agents always have consent_required true", () => {
  const inputs = [
    { direction: "outbound", consent_required: false },
    { direction: "outbound", consent_required: true },
    { direction: "both", consent_required: false },
    { direction: "both", consent_required: true },
  ];
  for (const a of inputs) {
    const final = forceOutboundConsent(a);
    assert.equal(final.consent_required, true, `direction=${a.direction} must lock consent`);
  }
});

test("force-outbound-consent: inbound agents may opt out of consent gate", () => {
  const a = forceOutboundConsent({ direction: "inbound", consent_required: false });
  assert.equal(a.consent_required, false);
});

test("force-outbound-consent: cannot flip back to false after enabled outbound", () => {
  let a = { direction: "outbound", consent_required: true };
  a = forceOutboundConsent({ ...a, consent_required: false });
  assert.equal(a.consent_required, true, "downgrade attempt must be blocked");
});

function forceOutboundConsent(agent) {
  const next = { ...agent };
  if (agent.direction === "outbound" || agent.direction === "both") {
    next.consent_required = true;
  }
  return next;
}

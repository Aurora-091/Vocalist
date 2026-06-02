const assert = require("node:assert/strict");
const { test } = require("node:test");
const { canTransition, STATES } = require("../../modules/campaigns/state-machine");

test("state machine: queued can transition to dialing", () => {
  assert.equal(canTransition(STATES.QUEUED, STATES.DIALING), true);
});

test("state machine: completed is terminal", () => {
  assert.equal(canTransition(STATES.COMPLETED, STATES.QUEUED), false);
  assert.equal(canTransition(STATES.COMPLETED, STATES.DIALING), false);
});

test("state machine: do_not_call is terminal", () => {
  assert.equal(canTransition(STATES.DO_NOT_CALL, STATES.QUEUED), false);
});

test("state machine: dialing cannot skip to completed without intermediate", () => {
  assert.equal(canTransition(STATES.DIALING, STATES.COMPLETED), true);
  assert.equal(canTransition(STATES.QUEUED, STATES.COMPLETED), false);
});

test("state machine: failed leads to retry_wait", () => {
  assert.equal(canTransition(STATES.FAILED, STATES.RETRY_WAIT), true);
});

test("state machine: retry_wait can re-queue", () => {
  assert.equal(canTransition(STATES.RETRY_WAIT, STATES.QUEUED), true);
});

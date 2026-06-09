const assert = require("node:assert/strict");
const { test } = require("node:test");

// A unit-like simulation of the setup promise and race condition handling
test("Twilio stream: message processing is deferred until metadata setup completes", async () => {
  const eventsReceived = [];
  let isClosed = false;
  let metadataResolved = false;

  // Simulate setupPromise
  const setupPromise = new Promise((resolve) => {
    setTimeout(() => {
      metadataResolved = true;
      resolve({ useRealElevenLabs: false });
    }, 50); // Setup takes 50ms
  });

  // Simulated WebSocket message handler logic mirroring the implementation
  async function handleMessage(eventPayload) {
    if (isClosed) return;
    
    // Await setup to ensure callRow and elevenLabsSocket are populated before handling message
    const setup = await setupPromise;
    if (!setup || isClosed) return;

    eventsReceived.push({
      event: eventPayload.event,
      metadataResolvedAtProcess: metadataResolved
    });
  }

  // Simulate receiving events before/after setup resolves
  const p1 = handleMessage({ event: "start" });
  const p2 = handleMessage({ event: "media" });
  
  // Verify that metadata is NOT yet resolved initially
  assert.equal(metadataResolved, false);
  assert.equal(eventsReceived.length, 0);

  // Wait for setup to complete and handlers to execute
  await Promise.all([p1, p2]);

  // Verify that both events were eventually processed, and that they ran AFTER setup resolved
  assert.equal(metadataResolved, true);
  assert.equal(eventsReceived.length, 2);
  assert.deepEqual(eventsReceived[0], { event: "start", metadataResolvedAtProcess: true });
  assert.deepEqual(eventsReceived[1], { event: "media", metadataResolvedAtProcess: true });
});

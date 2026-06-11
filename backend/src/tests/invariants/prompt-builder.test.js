const assert = require("node:assert/strict");
const { test } = require("node:test");
const { generateSystemPrompt } = require("../../utils/promptBuilder");

test("prompt always includes compliance disclosure section", () => {
  const prompt = generateSystemPrompt({
    identity: { name: "TestBot", role: "assistant", company: "Acme" },
    goals: ["Book appointments"],
  });
  assert.ok(prompt.includes("Compliance & Consent Disclosure"));
  assert.ok(prompt.includes("recorded for quality and training"));
});

test("prompt includes DNC compliance language", () => {
  const prompt = generateSystemPrompt({});
  assert.ok(prompt.includes("removed from the call list"));
  assert.ok(prompt.includes("DNC"));
});

test("prompt includes business identification requirement", () => {
  const prompt = generateSystemPrompt({
    identity: { name: "Agent", role: "caller", company: "TestCo" },
  });
  assert.ok(prompt.includes("identify the business name within"));
});

test("prompt includes recording acknowledgment gate", () => {
  const prompt = generateSystemPrompt({});
  assert.ok(prompt.includes("acknowledged the recording disclosure"));
});

test("prompt preserves custom guardrails alongside compliance", () => {
  const prompt = generateSystemPrompt({
    guardrails: ["Never discuss pricing", "Always be polite"],
  });
  assert.ok(prompt.includes("Never discuss pricing"));
  assert.ok(prompt.includes("Always be polite"));
  assert.ok(prompt.includes("Compliance & Consent Disclosure"));
});

test("empty persona still produces valid prompt with compliance", () => {
  const prompt = generateSystemPrompt(null);
  assert.ok(typeof prompt === "string");
  assert.ok(prompt.length > 100);
  assert.ok(prompt.includes("Compliance & Consent Disclosure"));
});

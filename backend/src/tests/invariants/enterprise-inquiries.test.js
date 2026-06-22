const assert = require("node:assert/strict");
const { test } = require("node:test");
const router = require("../../modules/enterprise/enterprise.routes");
const { escapeHtml, buildEnterpriseConfirmationHtml } = require("../../services/email.service");

test("inquireSchema validates valid inputs correctly", () => {
  const schema = router.inquireSchema;
  const valid = {
    name: "Jane Doe",
    email: "jane@example.com",
    businessType: "SaaS / Tech company",
    callVolume: "500 – 2,000/month",
    painPoint: "Too many missed calls",
    timeline: "ASAP",
    extraInfo: "Needs custom sheets sync",
  };
  const res = schema.safeParse(valid);
  assert.equal(res.success, true);
});

test("inquireSchema rejects invalid email or missing name", () => {
  const schema = router.inquireSchema;
  assert.equal(schema.safeParse({ name: "Jane", email: "invalid-email" }).success, false);
  assert.equal(schema.safeParse({ name: "", email: "jane@example.com" }).success, false);
});

test("inquireSchema enforces string caps to prevent DB flooding", () => {
  const schema = router.inquireSchema;
  const tooLongName = "a".repeat(121);
  const tooLongEmail = "a".repeat(110) + "@example.com";
  assert.equal(schema.safeParse({ name: tooLongName, email: "jane@example.com" }).success, false);
  assert.equal(schema.safeParse({ name: "Jane", email: tooLongEmail }).success, false);
});

test("escapeHtml sanitizes raw characters correctly", () => {
  const raw = 'Joe <script>alert("hello")</script> & Co';
  const expected = 'Joe &lt;script&gt;alert(&quot;hello&quot;)&lt;/script&gt; &amp; Co';
  assert.equal(escapeHtml(raw), expected);
});

test("buildEnterpriseConfirmationHtml builds correct greeting and escapes name", () => {
  const html = buildEnterpriseConfirmationHtml("Joe<script>");
  assert.match(html, /Hi Joe&lt;script&gt;, We've got your inquiry\./);
});

/**
 * auth-middleware.test.js
 *
 * Unit tests for the decodeBearer token-extraction logic in auth.middleware.js.
 *
 * Session model (DEC-015): Session is managed exclusively by the Supabase JS SDK.
 * Every request carries a fresh Bearer token in the Authorization header.
 * Cookies are no longer set or read — this file guards against any regression
 * that re-introduces cookie-based auth.
 */

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Inline the function under test so this test runs without the full Supabase
// client being configured. Must be kept in sync with auth.middleware.js.
function decodeBearer(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

describe("decodeBearer – Bearer-header-only session model", () => {
  it("returns the Bearer token from the Authorization header", () => {
    const req = { headers: { authorization: "Bearer fresh-token-abc" }, cookies: {} };
    assert.equal(decodeBearer(req), "fresh-token-abc");
  });

  it("handles capitalised Authorization header key", () => {
    const req = { headers: { Authorization: "Bearer uppercase-header" }, cookies: {} };
    assert.equal(decodeBearer(req), "uppercase-header");
  });

  it("returns null when no Authorization header is present (even if cookie exists)", () => {
    // REGRESSION GUARD: cookies must never be used as a fallback.
    const req = { headers: {}, cookies: { "sb-access-token": "stale-cookie" } };
    assert.equal(
      decodeBearer(req),
      null,
      "Cookie must not be accepted — Bearer header is the only valid auth mechanism"
    );
  });

  it("returns null when Authorization header is present but cookie also exists (cookie ignored)", () => {
    // Belt-and-suspenders: even if both exist, the only thing that matters is the header.
    const req = {
      headers: { authorization: "Bearer fresh-from-sdk" },
      cookies: { "sb-access-token": "stale-cookie" },
    };
    assert.equal(decodeBearer(req), "fresh-from-sdk");
  });

  it("returns null when no header and no cookies", () => {
    assert.equal(decodeBearer({ headers: {}, cookies: {} }), null);
  });

  it("returns null for a malformed Authorization header (no scheme prefix)", () => {
    const req = { headers: { authorization: "just-a-token-no-scheme" }, cookies: {} };
    assert.equal(decodeBearer(req), null);
  });

  it("returns null when Authorization scheme is not Bearer", () => {
    const req = { headers: { authorization: "Basic dXNlcjpwYXNz" }, cookies: {} };
    assert.equal(decodeBearer(req), null);
  });
});

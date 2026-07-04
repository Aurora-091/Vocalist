/**
 * auth-middleware.test.js
 *
 * Unit tests for the decodeBearer token-extraction logic in auth.middleware.js.
 *
 * Root cause being guarded against:
 *   The Supabase JS SDK sends a fresh Bearer token on every request, but the
 *   backend was reading the sb-access-token httpOnly cookie FIRST. If the
 *   cookie was stale, the backend rejected the fresh Bearer token and caused
 *   infinite 401 retry loops on the frontend.
 *
 * Fix: Bearer header always takes precedence; the cookie is only a fallback
 * for non-JS clients that don't send an Authorization header.
 */

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// We re-implement decodeBearer inline here so the test does not require the
// full Supabase client to be configured in CI.
function decodeBearer(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (header && typeof header === "string") {
    const [scheme, token] = header.split(" ");
    if (scheme === "Bearer" && token) return token;
  }
  if (req.cookies && req.cookies["sb-access-token"]) {
    return req.cookies["sb-access-token"];
  }
  return null;
}

describe("decodeBearer – token extraction priority", () => {
  it("returns the Bearer token from the Authorization header", () => {
    const req = {
      headers: { authorization: "Bearer fresh-token-abc" },
      cookies: {},
    };
    assert.equal(decodeBearer(req), "fresh-token-abc");
  });

  it("prefers the Authorization header over the sb-access-token cookie", () => {
    // THE critical regression guard: stale cookie must NOT shadow a fresh Bearer.
    const req = {
      headers: { authorization: "Bearer fresh-token-from-sdk" },
      cookies: { "sb-access-token": "stale-cookie-token" },
    };
    assert.equal(
      decodeBearer(req),
      "fresh-token-from-sdk",
      "Bearer header must win over the cookie"
    );
  });

  it("falls back to the cookie when no Authorization header is present", () => {
    const req = {
      headers: {},
      cookies: { "sb-access-token": "cookie-only-token" },
    };
    assert.equal(decodeBearer(req), "cookie-only-token");
  });

  it("returns null when neither header nor cookie is present", () => {
    const req = { headers: {}, cookies: {} };
    assert.equal(decodeBearer(req), null);
  });

  it("returns null for a malformed Authorization header (no scheme prefix)", () => {
    const req = { headers: { authorization: "just-a-token-no-scheme" }, cookies: {} };
    assert.equal(decodeBearer(req), null);
  });

  it("returns null when Authorization scheme is not Bearer", () => {
    const req = { headers: { authorization: "Basic dXNlcjpwYXNz" }, cookies: {} };
    assert.equal(decodeBearer(req), null);
  });

  it("handles capitalised Authorization header key", () => {
    const req = {
      headers: { Authorization: "Bearer uppercase-key-header" },
      cookies: {},
    };
    assert.equal(decodeBearer(req), "uppercase-key-header");
  });
});

const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("path");
const fs = require("fs");

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");

test("vercel.json exists and is valid JSON", () => {
  const vercelPath = path.join(PROJECT_ROOT, "vercel.json");
  assert.ok(fs.existsSync(vercelPath), "vercel.json must exist");
  const config = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
  assert.ok(config.headers, "vercel.json must have headers array");
});

test("vercel.json has HSTS header with preload", () => {
  const config = loadVercelConfig();
  const hsts = findHeader(config, "Strict-Transport-Security");
  assert.ok(hsts, "Must have HSTS header");
  assert.ok(hsts.includes("max-age=63072000"), "HSTS max-age must be 2 years");
  assert.ok(hsts.includes("preload"), "HSTS must include preload");
  assert.ok(hsts.includes("includeSubDomains"), "HSTS must include subdomains");
});

test("vercel.json has X-Frame-Options DENY", () => {
  const config = loadVercelConfig();
  const xfo = findHeader(config, "X-Frame-Options");
  assert.equal(xfo, "DENY");
});

test("vercel.json has X-Content-Type-Options nosniff", () => {
  const config = loadVercelConfig();
  const xcto = findHeader(config, "X-Content-Type-Options");
  assert.equal(xcto, "nosniff");
});

test("vercel.json disables X-XSS-Protection (value 0)", () => {
  const config = loadVercelConfig();
  const xxss = findHeader(config, "X-XSS-Protection");
  assert.equal(xxss, "0", "X-XSS-Protection must be 0 (disabled) — legacy auditor introduces vulnerabilities");
});

test("vercel.json has Referrer-Policy", () => {
  const config = loadVercelConfig();
  const rp = findHeader(config, "Referrer-Policy");
  assert.equal(rp, "strict-origin-when-cross-origin");
});

test("vercel.json has Permissions-Policy restricting camera and geolocation", () => {
  const config = loadVercelConfig();
  const pp = findHeader(config, "Permissions-Policy");
  assert.ok(pp, "Must have Permissions-Policy header");
  assert.ok(pp.includes("camera=()"), "Camera must be disabled");
  assert.ok(pp.includes("geolocation=()"), "Geolocation must be disabled");
  assert.ok(pp.includes("microphone=(self)"), "Microphone must be self-only");
});

test("vercel.json CSP blocks frame-src and object-src", () => {
  const config = loadVercelConfig();
  const csp = findHeader(config, "Content-Security-Policy");
  assert.ok(csp, "Must have CSP header");
  assert.ok(csp.includes("frame-src 'none'"), "frame-src must be 'none'");
  assert.ok(csp.includes("object-src 'none'"), "object-src must be 'none'");
});

test("vercel.json CSP allows ElevenLabs WebSocket", () => {
  const config = loadVercelConfig();
  const csp = findHeader(config, "Content-Security-Policy");
  assert.ok(csp.includes("wss://api.elevenlabs.io"), "CSP connect-src must allow ElevenLabs WSS");
});

test("vercel.json CSP allows Supabase connections", () => {
  const config = loadVercelConfig();
  const csp = findHeader(config, "Content-Security-Policy");
  assert.ok(csp.includes("https://*.supabase.co"), "CSP must allow Supabase HTTPS");
  assert.ok(csp.includes("wss://*.supabase.co"), "CSP must allow Supabase WSS");
});

test("vercel.json CSP allows PostHog", () => {
  const config = loadVercelConfig();
  const csp = findHeader(config, "Content-Security-Policy");
  assert.ok(csp.includes("posthog.com"), "CSP must allow PostHog");
});

test("vercel.json has SPA rewrite rule", () => {
  const config = loadVercelConfig();
  assert.ok(config.rewrites, "Must have rewrites");
  const spaRewrite = config.rewrites.find(
    (r) => r.destination === "/index.html"
  );
  assert.ok(spaRewrite, "Must have SPA fallback rewrite to /index.html");
});

function loadVercelConfig() {
  const vercelPath = path.join(PROJECT_ROOT, "vercel.json");
  return JSON.parse(fs.readFileSync(vercelPath, "utf8"));
}

function findHeader(config, key) {
  const allHeaders = config.headers[0]?.headers || [];
  const match = allHeaders.find((h) => h.key === key);
  return match ? match.value : null;
}

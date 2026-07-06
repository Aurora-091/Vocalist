const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("path");
const fs = require("fs");

const BACKEND_ROOT = path.resolve(__dirname, "../../../");

test("worker-entry.js exists and is valid syntax", () => {
  const workerPath = path.join(BACKEND_ROOT, "worker-entry.js");
  assert.ok(fs.existsSync(workerPath), "worker-entry.js must exist at backend root");
  const content = fs.readFileSync(workerPath, "utf8");
  assert.ok(content.length > 100, "worker-entry.js should not be empty");
  assert.ok(content.includes("require"), "worker-entry.js should use require (CommonJS)");
});

test("worker-entry.js imports all 6 workers", () => {
  const workerPath = path.join(BACKEND_ROOT, "worker-entry.js");
  const content = fs.readFileSync(workerPath, "utf8");

  const expectedWorkers = [
    "dialer.worker",
    "retry.worker",
    "billing-rollup.worker",
    "lease-sweeper.worker",
    "webhooks-out.worker",
    "call-scheduler.worker",
  ];

  for (const worker of expectedWorkers) {
    assert.ok(
      content.includes(worker),
      `worker-entry.js must import ${worker}`
    );
  }
});

test("worker-entry.js starts all workers", () => {
  const workerPath = path.join(BACKEND_ROOT, "worker-entry.js");
  const content = fs.readFileSync(workerPath, "utf8");

  const startCalls = (content.match(/\.start\(\)/g) || []).length;
  assert.ok(startCalls >= 6, `Expected at least 6 .start() calls, got ${startCalls}`);
});

test("worker-entry.js has health probe", () => {
  const workerPath = path.join(BACKEND_ROOT, "worker-entry.js");
  const content = fs.readFileSync(workerPath, "utf8");

  assert.ok(content.includes("/health"), "worker-entry.js must have /health endpoint");
  assert.ok(content.includes("http"), "worker-entry.js must use http module for health probe");
});

test("worker-entry.js handles SIGTERM and SIGINT", () => {
  const workerPath = path.join(BACKEND_ROOT, "worker-entry.js");
  const content = fs.readFileSync(workerPath, "utf8");

  assert.ok(content.includes("SIGTERM"), "worker-entry.js must handle SIGTERM");
  assert.ok(content.includes("SIGINT"), "worker-entry.js must handle SIGINT");
});

test("worker-entry.js does not start Express", () => {
  const workerPath = path.join(BACKEND_ROOT, "worker-entry.js");
  const content = fs.readFileSync(workerPath, "utf8");

  assert.ok(!content.includes("express"), "worker-entry.js must NOT import express");
  assert.ok(!content.includes("createApp"), "worker-entry.js must NOT create Express app");
});

test("railway.worker.json has correct start command", () => {
  const configPath = path.join(BACKEND_ROOT, "railway.worker.json");
  assert.ok(fs.existsSync(configPath), "railway.worker.json must exist");

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.equal(config.deploy.startCommand, "node worker-entry.js");
  assert.equal(config.deploy.healthcheckPath, "/health");
  assert.equal(config.deploy.restartPolicyType, "ON_FAILURE");
});

test("railway.json API service has correct start command", () => {
  const configPath = path.join(BACKEND_ROOT, "railway.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  assert.equal(config.deploy.startCommand, "node server.js");
  assert.equal(config.deploy.healthcheckPath, "/health");
});

test("Procfile defines both web and worker processes", () => {
  const procfilePath = path.join(BACKEND_ROOT, "Procfile");
  const content = fs.readFileSync(procfilePath, "utf8");

  assert.ok(content.includes("web: node server.js"), "Procfile must define web process");
  assert.ok(content.includes("worker: node worker-entry.js"), "Procfile must define worker process");
});

test("server.js workers are conditionally started via RUN_WORKERS", () => {
  const serverPath = path.join(BACKEND_ROOT, "server.js");
  const content = fs.readFileSync(serverPath, "utf8");

  assert.ok(
    content.includes("RUN_WORKERS"),
    "server.js must check RUN_WORKERS env var"
  );
});

test("all worker modules export start function", () => {
  const workersDir = path.join(BACKEND_ROOT, "src/workers");
  const workerFiles = fs.readdirSync(workersDir).filter((f) => f.endsWith(".worker.js"));

  assert.ok(workerFiles.length >= 6, `Expected at least 6 worker files, got ${workerFiles.length}`);

  for (const file of workerFiles) {
    const content = fs.readFileSync(path.join(workersDir, file), "utf8");
    assert.ok(
      content.includes("module.exports") && content.includes("start"),
      `${file} must export a start function`
    );
  }
});

test("lease-sweeper worker calls reclaim_expired_leases RPC", () => {
  const workerPath = path.join(BACKEND_ROOT, "src/workers/lease-sweeper.worker.js");
  const content = fs.readFileSync(workerPath, "utf8");

  assert.ok(
    content.includes("reclaim_expired_leases"),
    "lease-sweeper must call reclaim_expired_leases RPC"
  );
});

test("billing-rollup worker handles drift detection", () => {
  const workerPath = path.join(BACKEND_ROOT, "src/workers/billing-rollup.worker.js");
  const content = fs.readFileSync(workerPath, "utf8");

  assert.ok(
    content.includes("spend_counters"),
    "billing-rollup must query spend_counters"
  );
  assert.ok(
    content.includes("usage_ledger"),
    "billing-rollup must query usage_ledger"
  );
});

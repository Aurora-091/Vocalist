const logger = require("./src/config/logger");
const { shutdownPostHog } = require("./src/config/posthog");

const dialerWorker = require("./src/workers/dialer.worker");
const retryWorker = require("./src/workers/retry.worker");
const billingRollup = require("./src/workers/billing-rollup.worker");
const leaseSweeper = require("./src/workers/lease-sweeper.worker");
const webhooksOut = require("./src/workers/webhooks-out.worker");
const callScheduler = require("./src/workers/call-scheduler.worker");

const env = require("./src/config/env");

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  logger.fatal("SUPABASE_SERVICE_ROLE_KEY is required for workers");
  process.exit(1);
}

logger.info("Starting worker service (no HTTP)");

const stoppers = [];
stoppers.push(dialerWorker.start());
stoppers.push(retryWorker.start());
stoppers.push(billingRollup.start());
stoppers.push(leaseSweeper.start());
stoppers.push(webhooksOut.start());
stoppers.push(callScheduler.start());

logger.info({ count: stoppers.length }, "All workers started");

// Minimal HTTP probe for Railway healthcheck (lightweight, no Express)
const http = require("http");
const HEALTH_PORT = process.env.WORKER_HEALTH_PORT || 3001;

const healthServer = http.createServer((req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "UP", service: "workers", uptime: process.uptime() }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(HEALTH_PORT, () => {
  logger.info({ port: HEALTH_PORT }, "Worker health probe listening");
});

function shutdown(signal) {
  logger.info({ signal }, "Worker service shutting down");
  stoppers.forEach((stop) => { try { stop(); } catch {} });
  healthServer.close();
  shutdownPostHog().catch(() => {});
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger.error({ err }, "unhandledRejection"));
process.on("uncaughtException", (err) => logger.error({ err }, "uncaughtException"));

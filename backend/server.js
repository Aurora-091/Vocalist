const env = require("./src/config/env");
const logger = require("./src/config/logger");
const createApp = require("./src/app");

const dialerWorker = require("./src/workers/dialer.worker");
const retryWorker = require("./src/workers/retry.worker");
const billingRollup = require("./src/workers/billing-rollup.worker");
const leaseSweeper = require("./src/workers/lease-sweeper.worker");
const webhooksOut = require("./src/workers/webhooks-out.worker");

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "Aurora API listening");
});

// Intercept upgrades for Twilio Media Streams
const { WebSocketServer } = require("ws");
const { handleTwilioStream } = require("./src/services/twilio-stream.service");

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, req) => {
  handleTwilioStream(ws, req);
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/v1/twilio/stream/")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

const stoppers = [];
if (process.env.RUN_WORKERS === "1") {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn("RUN_WORKERS=1 but SUPABASE_SERVICE_ROLE_KEY is not set; workers disabled");
  } else {
    logger.info("Starting background workers");
    stoppers.push(dialerWorker.start());
    stoppers.push(retryWorker.start());
    stoppers.push(billingRollup.start());
    stoppers.push(leaseSweeper.start());
    stoppers.push(webhooksOut.start());
  }
}

function shutdown(signal) {
  logger.info({ signal }, "Shutting down");
  stoppers.forEach((stop) => { try { stop(); } catch {} });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger.error({ err }, "unhandledRejection"));
process.on("uncaughtException", (err) => logger.error({ err }, "uncaughtException"));

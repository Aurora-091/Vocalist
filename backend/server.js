const env = require("./src/config/env");
const logger = require("./src/config/logger");
const Sentry = require("@sentry/node");
const { shutdownPostHog } = require("./src/config/posthog");

if (process.env.SENTRY_DSN) {
  const pkg = require("./package.json");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: `weeber-backend@${pkg.version}`,
    environment: env.NODE_ENV || "development",
    tracesSampleRate: env.NODE_ENV === "production" ? 0.2 : 1.0,
  });
}

const createApp = require("./src/app");

const dialerWorker = require("./src/workers/dialer.worker");
const retryWorker = require("./src/workers/retry.worker");
const billingRollup = require("./src/workers/billing-rollup.worker");
const leaseSweeper = require("./src/workers/lease-sweeper.worker");
const webhooksOut = require("./src/workers/webhooks-out.worker");
const callScheduler = require("./src/workers/call-scheduler.worker");

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "Aurora API listening");
});

// Intercept upgrades for Twilio Media Streams + Waitlist counter
const { WebSocketServer } = require("ws");
const { handleTwilioStream } = require("./src/services/twilio-stream.service");
const { waitlistWss } = require("./src/modules/waitlist/waitlist.ws");

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, req) => {
  handleTwilioStream(ws, req);
});

wss.on("error", (err) => {
  logger.error({ err: err.message }, "Twilio WSS server error");
  if (process.env.SENTRY_DSN) Sentry.captureException(err, { tags: { component: "wss-twilio" } });
});

waitlistWss.on("error", (err) => {
  logger.error({ err: err.message }, "Waitlist WSS server error");
  if (process.env.SENTRY_DSN) Sentry.captureException(err, { tags: { component: "wss-waitlist" } });
});

// Heartbeat: detect and clean up dead connections every 30s
const HEARTBEAT_INTERVAL = 30_000;
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      logger.warn("Terminating unresponsive Twilio WS client");
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  }
  for (const ws of waitlistWss.clients) {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL);

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
});

server.on("upgrade", (request, socket, head) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/v1/twilio/stream/")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else if (url.pathname === "/ws/waitlist") {
      waitlistWss.handleUpgrade(request, socket, head, (ws) => {
        waitlistWss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  } catch (err) {
    logger.error({ err: err.message, url: request.url }, "WebSocket upgrade failed");
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
    stoppers.push(callScheduler.start());
  }
}

function shutdown(signal) {
  logger.info({ signal }, "Shutting down");
  clearInterval(heartbeat);
  stoppers.forEach((stop) => { try { stop(); } catch {} });
  for (const ws of wss.clients) ws.terminate();
  for (const ws of waitlistWss.clients) ws.terminate();
  shutdownPostHog().catch(() => {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger.error({ err }, "unhandledRejection"));
process.on("uncaughtException", (err) => logger.error({ err }, "uncaughtException"));

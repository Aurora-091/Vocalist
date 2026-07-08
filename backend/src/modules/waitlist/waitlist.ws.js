const { WebSocketServer } = require("ws");
const { requireAdmin } = require("../../config/supabase");
const logger = require("../../config/logger");

const OFFSET = 43;

const waitlistWss = new WebSocketServer({ noServer: true });
const clients = new Set();

waitlistWss.on("connection", async (ws) => {
  logger.info("Waitlist WebSocket client connected");
  clients.add(ws);
  ws.on("close", (code, reason) => {
    logger.info({ code, reason: reason ? reason.toString() : "" }, "Waitlist WebSocket client disconnected");
    clients.delete(ws);
  });
  ws.on("error", (err) => {
    logger.error({ err }, "Waitlist WebSocket client error");
    clients.delete(ws);
  });

  try {
    const count = await getCount();
    logger.info({ count }, "Sending initial waitlist count to client");
    ws.send(JSON.stringify({ type: "waitlist_count", count }));
  } catch (err) {
    logger.error({ err }, "Failed to send initial waitlist count");
  }
});

async function getCount() {
  const admin = requireAdmin();
  const { count, error } = await admin.from("waitlist").select("*", { count: "exact", head: true });
  if (error) throw error;
  return OFFSET + (count || 0);
}

async function broadcastWaitlistCount() {
  try {
    const count = await getCount();
    logger.info({ count, clientCount: clients.size }, "Broadcasting waitlist count to clients");
    const msg = JSON.stringify({ type: "waitlist_count", count });
    for (const ws of clients) {
      if (ws.readyState === 1) {
        ws.send(msg);
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to broadcast waitlist count");
  }
}

module.exports = { waitlistWss, broadcastWaitlistCount };

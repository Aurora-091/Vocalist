const { WebSocketServer } = require("ws");
const { requireAdmin } = require("../../config/supabase");
const logger = require("../../config/logger");

const OFFSET = 167;

const waitlistWss = new WebSocketServer({ noServer: true });
const clients = new Set();

waitlistWss.on("connection", async (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));

  try {
    const count = await getCount();
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

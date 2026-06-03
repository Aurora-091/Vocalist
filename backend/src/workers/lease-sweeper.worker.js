const { requireAdmin } = require("../config/supabase");
const logger = require("../config/logger");

async function runOnce() {
  const admin = requireAdmin();
  const { data, error } = await admin.rpc("reclaim_expired_leases", { p_limit: 500 });
  if (error) throw error;
  if (data && data > 0) {
    logger.warn({ reclaimed: data }, "Reclaimed expired dial leases");
  }
  return { reclaimed: data || 0 };
}

function start({ intervalMs = 30_000 } = {}) {
  let stopped = false;
  async function loop() {
    while (!stopped) {
      try {
        await runOnce();
      } catch (err) {
        logger.error({ err: err.message }, "Lease sweeper error");
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  loop();
  return () => { stopped = true; };
}

module.exports = { start, runOnce };

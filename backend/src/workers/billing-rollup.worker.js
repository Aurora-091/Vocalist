const { requireAdmin } = require("../config/supabase");
const logger = require("../config/logger");

async function runOnce() {
  const admin = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: orgs, error } = await admin
    .from("usage_ledger")
    .select("org_id, kind, quantity, period")
    .eq("period", today);
  if (error) throw error;

  const byOrg = {};
  for (const row of orgs || []) {
    const key = `${row.org_id}|${row.kind}`;
    byOrg[key] = (byOrg[key] || 0) + Number(row.quantity);
  }

  return { orgs_seen: Object.keys(byOrg).length, period: today };
}

function start({ intervalMs = 600_000 } = {}) {
  let stopped = false;
  async function loop() {
    while (!stopped) {
      try {
        await runOnce();
      } catch (err) {
        logger.error({ err: err.message }, "Billing rollup error");
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  loop();
  return () => { stopped = true; };
}

module.exports = { start, runOnce };

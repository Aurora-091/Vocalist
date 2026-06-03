const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAuth, requireOrg } = require("../../middleware/auth.middleware");

const router = express.Router();
router.use(requireAuth, requireOrg);

function parseRange(req) {
  const now = new Date();
  const to = req.query.to ? new Date(req.query.to) : now;
  const from = req.query.from
    ? new Date(req.query.from)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req);
    const { data, error } = await req.supabase.rpc("analytics_overview", {
      p_from: from,
      p_to: to,
    });
    if (error) throw error;
    res.json({ from, to, ...data });
  })
);

router.get(
  "/outcomes",
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req);
    const { data, error } = await req.supabase.rpc("analytics_outcomes", {
      p_from: from,
      p_to: to,
    });
    if (error) throw error;
    res.json({ from, to, outcomes: data });
  })
);

router.get(
  "/optouts",
  asyncHandler(async (req, res) => {
    const { from, to } = parseRange(req);
    const { data, error } = await req.supabase.rpc("analytics_optouts", {
      p_from: from,
      p_to: to,
    });
    if (error) throw error;
    res.json({ from, to, series: data });
  })
);

router.get(
  "/usage",
  asyncHandler(async (req, res) => {
    const period = req.query.period || new Date().toISOString().slice(0, 10);
    const { data, error } = await req.supabase.rpc("analytics_usage", { p_period: period });
    if (error) throw error;
    res.json(data);
  })
);

router.get(
  "/campaigns/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { data: targets, error: tErr } = await req.supabase
      .from("campaign_targets")
      .select("state")
      .eq("campaign_id", id)
      .eq("org_id", req.auth.orgId);
    if (tErr) throw tErr;

    const counts = {};
    for (const t of targets || []) {
      counts[t.state] = (counts[t.state] || 0) + 1;
    }

    const { data: calls } = await req.supabase
      .from("calls")
      .select("outcome, status, duration_sec")
      .eq("campaign_id", id)
      .eq("org_id", req.auth.orgId)
      .limit(5000);

    let recovered_value = 0;
    let bookings = 0;
    let opt_outs = 0;
    for (const c of calls || []) {
      const o = c.outcome || {};
      if (o.recovered_value) recovered_value += Number(o.recovered_value) || 0;
      if (o.booked === true) bookings += 1;
      if (o.opt_out === true) opt_outs += 1;
    }

    res.json({
      campaign_id: id,
      target_states: counts,
      calls: (calls || []).length,
      recovered_value,
      bookings,
      opt_outs,
    });
  })
);

module.exports = router;

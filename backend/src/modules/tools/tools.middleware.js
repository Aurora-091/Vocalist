const { requireAdmin } = require("../../config/supabase");
const logger = require("../../config/logger");

async function resolveOrgFromAgent(req, res, next) {
  const agentId = req.headers["x-weeber-agent-id"];
  const secret = req.headers["x-weeber-secret"];

  if (secret !== process.env.WEEBER_TOOL_SECRET) {
    logger.warn({ secret }, "Tool request unauthorized due to missing/invalid WEEBER_TOOL_SECRET");
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!agentId) {
    return res.status(400).json({ error: "missing agent id" });
  }

  const admin = requireAdmin();
  try {
    const { data: agent, error } = await admin
      .from("agents")
      .select("id, org_id, vertical")
      .eq("id", agentId)
      .maybeSingle();

    if (error || !agent) {
      logger.warn({ agentId, error: error?.message }, "Agent not found in tools middleware lookup");
      return res.status(404).json({ error: "agent not found" });
    }

    req.agentId = agent.id;
    req.orgId = agent.org_id;
    req.vertical = agent.vertical;
    next();
  } catch (err) {
    logger.error({ err: err.message }, "Exception in resolveOrgFromAgent tools middleware");
    return res.status(500).json({ error: "internal_server_error" });
  }
}

module.exports = { resolveOrgFromAgent };

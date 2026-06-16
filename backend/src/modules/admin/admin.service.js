const { requireAdmin } = require("../../config/supabase");

async function getStats() {
  const admin = requireAdmin();

  const [usersRes, waitlistRes, activeUsersRes, callsTodayRes, monthlyCostRes, subscriptionsRes] = await Promise.all([
    admin.from("users").select("*", { count: "exact", head: true }),
    admin.from("waitlist").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("user_sessions").select("user_id", { count: "exact", head: true })
      .gte("last_active_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    admin.from("calls").select("*", { count: "exact", head: true })
      .gte("created_at", new Date().toISOString().split("T")[0]),
    admin.from("usage_ledger").select("amount")
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    admin.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const monthlyCost = (monthlyCostRes.data || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return {
    total_users: usersRes.count || 0,
    waitlist_pending: waitlistRes.count || 0,
    active_users_7d: activeUsersRes.count || 0,
    calls_today: callsTodayRes.count || 0,
    monthly_cost: monthlyCost,
    active_subscriptions: subscriptionsRes.count || 0,
  };
}

async function getRecentSignups(limit = 10) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("users")
    .select("id, email, display_name, role, created_at, org_id, orgs(name, plan_id)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function getRecentErrors(limit = 10) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("webhook_dlq")
    .select("id, source, event_type, error_message, created_at, org_id")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function listUsers({ page = 1, limit = 25, q = "" }) {
  const admin = requireAdmin();
  const offset = (page - 1) * limit;

  let query = admin
    .from("users")
    .select("id, email, display_name, role, platform_role, created_at, org_id, orgs(name, plan_id)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data || [], total: count || 0, page, limit };
}

async function getUserDetail(userId) {
  const admin = requireAdmin();

  const [userRes, usageRes, sessionsRes] = await Promise.all([
    admin.from("users").select("*, orgs(name, plan_id, created_at)").eq("id", userId).single(),
    admin.from("usage_ledger").select("kind, amount").eq("user_id", userId),
    admin.from("user_sessions").select("last_active_at").eq("user_id", userId).order("last_active_at", { ascending: false }).limit(1),
  ]);

  if (userRes.error) throw userRes.error;

  const usage = (usageRes.data || []).reduce((acc, r) => {
    acc[r.kind] = (acc[r.kind] || 0) + Number(r.amount);
    return acc;
  }, {});

  return {
    ...userRes.data,
    usage,
    last_active: sessionsRes.data?.[0]?.last_active_at || null,
  };
}

async function updateUser(userId, fields) {
  const admin = requireAdmin();
  const allowed = ["platform_role", "role"];
  const update = {};
  for (const k of allowed) {
    if (fields[k] !== undefined) update[k] = fields[k];
  }
  const { data, error } = await admin.from("users").update(update).eq("id", userId).select().single();
  if (error) throw error;
  return data;
}

async function listWaitlist({ page = 1, limit = 25, q = "", status = "" }) {
  const admin = requireAdmin();
  const offset = (page - 1) * limit;

  let query = admin
    .from("waitlist")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data || [], total: count || 0, page, limit };
}

async function updateWaitlistStatus(id, status) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("waitlist")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function bulkUpdateWaitlist(ids, status) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("waitlist")
    .update({ status })
    .in("id", ids)
    .select();
  if (error) throw error;
  return data;
}

async function listAgents({ page = 1, limit = 25, q = "" }) {
  const admin = requireAdmin();
  const offset = (page - 1) * limit;

  let query = admin
    .from("agents")
    .select("id, name, org_id, provider, vertical, created_at, deleted_at, orgs(name)", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data || [], total: count || 0, page, limit };
}

async function getAgentDetail(agentId) {
  const admin = requireAdmin();
  const [agentRes, callsRes] = await Promise.all([
    admin.from("agents").select("*, orgs(name, plan_id)").eq("id", agentId).single(),
    admin.from("calls").select("id, status, direction, duration_sec, cost_usd, created_at")
      .eq("agent_id", agentId).order("created_at", { ascending: false }).limit(20),
  ]);
  if (agentRes.error) throw agentRes.error;
  return { ...agentRes.data, recent_calls: callsRes.data || [] };
}

async function listBilling({ page = 1, limit = 25 }) {
  const admin = requireAdmin();
  const offset = (page - 1) * limit;
  const { data, count, error } = await admin
    .from("subscriptions")
    .select("*, orgs(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { data: data || [], total: count || 0, page, limit };
}

async function listLogs({ page = 1, limit = 50, severity = "" }) {
  const admin = requireAdmin();
  const offset = (page - 1) * limit;

  let query = admin
    .from("webhook_dlq")
    .select("id, org_id, source, event_type, error_message, retry_count, resolved_at, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (severity === "error") {
    query = query.is("resolved_at", null);
  } else if (severity === "resolved") {
    query = query.not("resolved_at", "is", null);
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data || [], total: count || 0, page, limit };
}

async function getSettings() {
  const admin = requireAdmin();
  const { data, error } = await admin.from("platform_settings").select("key, value, updated_at");
  if (error) throw error;
  return (data || []).reduce((acc, row) => {
    acc[row.key] = { value: row.value, updated_at: row.updated_at };
    return acc;
  }, {});
}

async function updateSetting(key, value, userId) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("platform_settings")
    .update({ value: JSON.stringify(value), updated_at: new Date().toISOString(), updated_by: userId })
    .eq("key", key)
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  getStats,
  getRecentSignups,
  getRecentErrors,
  listUsers,
  getUserDetail,
  updateUser,
  listWaitlist,
  updateWaitlistStatus,
  bulkUpdateWaitlist,
  listAgents,
  getAgentDetail,
  listBilling,
  listLogs,
  getSettings,
  updateSetting,
};

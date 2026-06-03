const supabase = require("../../config/db");

const TABLE = "orgs";
const SUBSCRIPTIONS_TABLE = "subscriptions";

async function create({ name, planId = null }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ name, plan_id: planId })
    .select("id, name, plan_id, created_at")
    .single();
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, plan_id, created_at, deleted_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function deleteById(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

async function createDefaultSubscription({
  orgId,
  planId,
  includedMinutes = 0,
  status = "active",
}) {
  const { data, error } = await supabase
    .from(SUBSCRIPTIONS_TABLE)
    .insert({
      org_id: orgId,
      plan_id: planId,
      included_minutes: includedMinutes,
      status,
    })
    .select("org_id, plan_id, included_minutes, status, updated_at")
    .single();
  if (error) throw error;
  return data;
}

async function findSubscription(orgId) {
  const { data, error } = await supabase
    .from(SUBSCRIPTIONS_TABLE)
    .select("org_id, plan_id, included_minutes, status, period_start, period_end, updated_at")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = {
  create,
  findById,
  deleteById,
  createDefaultSubscription,
  findSubscription,
};

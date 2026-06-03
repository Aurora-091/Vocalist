const supabase = require("../../config/db");

const TABLE = "agents";
const COLUMNS =
  "id, org_id, name, vertical, persona, voice_id, inbound_number, provider, provider_ref, created_at, updated_at, deleted_at";

async function listByOrg(orgId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function findByIdInOrg(id, orgId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("id", id)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function create({
  orgId,
  name,
  vertical = null,
  provider,
  voiceId = null,
  providerRef = null,
  persona = {},
}) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      org_id: orgId,
      name,
      vertical,
      provider,
      voice_id: voiceId,
      provider_ref: providerRef,
      persona,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function updateById({ id, orgId, patch }) {
  const updates = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function softDelete({ id, orgId }) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = {
  listByOrg,
  findByIdInOrg,
  create,
  updateById,
  softDelete,
};

const supabase = require("../../config/db");

const TABLE = "users";

const DEFAULT_COLUMNS = "id, org_id, email, role, created_at";

async function create({ id, orgId, email, role = "ops" }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ id, org_id: orgId, email, role })
    .select(DEFAULT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function findById(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(DEFAULT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findByIdInOrg(id, orgId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(DEFAULT_COLUMNS)
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function findByEmailInOrg(email, orgId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(DEFAULT_COLUMNS)
    .eq("email", email)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function listByOrg(orgId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(DEFAULT_COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function findOwnerByOrg(orgId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(DEFAULT_COLUMNS)
    .eq("org_id", orgId)
    .eq("role", "owner")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updateRole({ id, orgId, role }) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ role })
    .eq("id", id)
    .eq("org_id", orgId)
    .select(DEFAULT_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

async function deleteByIdInOrg(id, orgId) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) throw error;
}

module.exports = {
  create,
  findById,
  findByIdInOrg,
  findByEmailInOrg,
  listByOrg,
  findOwnerByOrg,
  updateRole,
  deleteByIdInOrg,
};

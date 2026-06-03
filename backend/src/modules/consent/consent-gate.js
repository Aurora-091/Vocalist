const env = require("../../config/env");

async function canDial(supabase, { orgId, e164, now = new Date(), tz = "America/New_York" }) {
  const { data, error } = await supabase.rpc("can_dial", {
    p_org: orgId,
    p_e164: e164,
    p_now: now.toISOString(),
    p_tz: tz,
  });
  if (error) throw error;
  return data === true;
}

async function evaluateGate(supabase, { orgId, e164, now = new Date(), tz = "America/New_York" }) {
  const reasons = [];

  const [contactRes, dncRes] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, consent_status, deleted_at")
      .eq("org_id", orgId)
      .eq("e164", e164)
      .maybeSingle(),
    supabase
      .from("dnc_list")
      .select("e164, reason")
      .eq("org_id", orgId)
      .eq("e164", e164)
      .maybeSingle(),
  ]);

  if (contactRes.error) throw contactRes.error;
  if (dncRes.error) throw dncRes.error;

  if (!contactRes.data) reasons.push("contact_not_found");
  else if (contactRes.data.deleted_at) reasons.push("contact_deleted");
  else if (contactRes.data.consent_status !== "granted") reasons.push("no_consent");

  if (dncRes.data) reasons.push(`dnc:${dncRes.data.reason}`);

  const localHour = new Date(now.toLocaleString("en-US", { timeZone: tz })).getHours();
  if (localHour < env.CALLING_HOUR_START || localHour > env.CALLING_HOUR_END) {
    reasons.push("outside_calling_hours");
  }

  return { allowed: reasons.length === 0, reasons, local_hour: localHour, tz };
}

module.exports = { canDial, evaluateGate };

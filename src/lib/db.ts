import { supabase } from "./supabase";

export async function getOrgId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const meta = data.session.user.app_metadata || {};
  return (meta as any).org_id || null;
}

// ───── Agents ─────

export async function listAgents() {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAgent(id: string) {
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createAgent(fields: {
  name: string;
  persona: Record<string, any>;
  consent_required?: boolean;
  provider?: string;
}) {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("agents")
    .insert({
      org_id: orgId,
      name: fields.name,
      persona: fields.persona,
      provider: fields.provider || "elevenlabs",
      consent_required: fields.consent_required ?? (fields.persona?.direction === "outbound"),
      languages: ["en"],
      business_hours: {},
      timezone: "America/New_York",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAgent(id: string, fields: Record<string, any>) {
  const { data, error } = await supabase
    .from("agents")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ───── Contacts ─────

export async function listContacts(opts?: { q?: string; limit?: number }) {
  let query = supabase
    .from("contacts")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(opts?.limit || 100);
  if (opts?.q) {
    query = query.or(`name.ilike.%${opts.q}%,e164.ilike.%${opts.q}%,email.ilike.%${opts.q}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createContact(fields: {
  phone: string;
  name?: string;
  email?: string;
  source?: string;
}) {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      org_id: orgId,
      e164: fields.phone.replace(/\s/g, ""),
      name: fields.name || null,
      email: fields.email || null,
      source: fields.source || "manual",
      consent_status: "none",
      tags: [],
      fields: {},
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ───── Campaigns ─────

export async function listCampaigns() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getCampaign(id: string) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createCampaign(fields: {
  name: string;
  agent_id: string;
  concurrency?: number;
  max_retries?: number;
}) {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      org_id: orgId,
      agent_id: fields.agent_id,
      name: fields.name,
      status: "draft",
      calling_tz: "America/New_York",
      concurrency: fields.concurrency || 3,
      max_retries: fields.max_retries || 2,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ───── Calls ─────

export async function listCalls(opts?: {
  direction?: string;
  agent_id?: string;
  campaign_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from("calls")
    .select("*, agents!inner(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(opts?.offset || 0, (opts?.offset || 0) + (opts?.limit || 20) - 1);
  if (opts?.direction) query = query.eq("direction", opts.direction);
  if (opts?.agent_id) query = query.eq("agent_id", opts.agent_id);
  if (opts?.campaign_id) query = query.eq("campaign_id", opts.campaign_id);
  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.date_from) query = query.gte("created_at", opts.date_from);
  if (opts?.date_to) query = query.lte("created_at", opts.date_to);
  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getCallsSummary(opts?: {
  agent_id?: string;
  campaign_id?: string;
  date_from?: string;
  date_to?: string;
}) {
  let query = supabase
    .from("calls")
    .select("cost_usd, duration_sec")
    .not("status", "eq", "queued");
  if (opts?.agent_id) query = query.eq("agent_id", opts.agent_id);
  if (opts?.campaign_id) query = query.eq("campaign_id", opts.campaign_id);
  if (opts?.date_from) query = query.gte("created_at", opts.date_from);
  if (opts?.date_to) query = query.lte("created_at", opts.date_to);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];
  const totalCost = rows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
  const totalDuration = rows.reduce((s, r) => s + (Number(r.duration_sec) || 0), 0);
  const completed = rows.filter((r) => r.duration_sec && r.duration_sec > 0);
  return {
    totalCost,
    totalDuration,
    avgCost: completed.length ? totalCost / completed.length : 0,
    avgDuration: completed.length ? totalDuration / completed.length : 0,
    count: rows.length,
  };
}

export async function getCall(id: string) {
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ───── Plan Tiers & Billing ─────

export async function listPlanTiers() {
  const { data, error } = await supabase
    .from("plan_tiers")
    .select("*")
    .eq("enabled", true)
    .order("monthly_usd", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getSubscription() {
  const orgId = await getOrgId();
  if (!orgId) return null;
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("org_id", orgId)
    .in("status", ["active", "cancel_at_period_end", "past_due", "trialing"])
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUsageSummary() {
  const orgId = await getOrgId();
  if (!orgId) return null;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: ledger, error } = await supabase
    .from("usage_ledger")
    .select("quantity")
    .eq("org_id", orgId)
    .eq("kind", "voice_minutes")
    .gte("period", startOfMonth.slice(0, 10));

  if (error) return null;

  const usedMinutes = (ledger || []).reduce(
    (sum, row) => sum + (Number(row.quantity) || 0),
    0
  );

  const sub = await getSubscription();
  let includedMinutes = 0;
  let overageRate = 0;
  if (sub?.plan_tier_key) {
    const { data: tier } = await supabase
      .from("plan_tiers")
      .select("included_minutes, overage_rate_usd")
      .eq("key", sub.plan_tier_key)
      .single();
    if (tier) {
      includedMinutes = tier.included_minutes;
      overageRate = Number(tier.overage_rate_usd) || 0;
    }
  }

  return {
    used_minutes: usedMinutes,
    included_minutes: includedMinutes || 400,
    pct_used: includedMinutes ? (usedMinutes / includedMinutes) * 100 : 0,
    overage_cost_usd: overageRate,
  };
}

// ───── Analytics (overview) ─────

export async function getOverview() {
  const orgId = await getOrgId();
  if (!orgId) return { calls_total: 0, calls_completed: 0, bookings: 0, opt_outs: 0 };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  const { count: callsTotal } = await supabase
    .from("calls")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("created_at", thirtyDaysAgo);

  const { count: callsCompleted } = await supabase
    .from("calls")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "completed")
    .gte("created_at", thirtyDaysAgo);

  const { count: optOuts } = await supabase
    .from("consent_events")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("new_status", "revoked")
    .gte("created_at", thirtyDaysAgo);

  return {
    calls_total: callsTotal || 0,
    calls_completed: callsCompleted || 0,
    bookings: 0,
    opt_outs: optOuts || 0,
  };
}

// ───── Onboarding ─────

export async function getOnboardingSteps() {
  const orgId = await getOrgId();
  if (!orgId) return null;
  const { data, error } = await supabase
    .from("onboarding_state")
    .select("steps")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) return null;
  return data?.steps || {
    pick_vertical: false,
    connect_tools: false,
    add_knowledge: false,
    create_agent: false,
    get_number: false,
    test_and_golive: false,
  };
}

export async function updateOnboardingStep(key: string, value: boolean) {
  const orgId = await getOrgId();
  if (!orgId) return;
  const current = await getOnboardingSteps();
  const updated = { ...current, [key]: value };
  await supabase
    .from("onboarding_state")
    .upsert({ org_id: orgId, steps: updated }, { onConflict: "org_id" });
}

// ───── Org Settings ─────

export async function getOrg() {
  const orgId = await getOrgId();
  if (!orgId) return null;
  const { data, error } = await supabase
    .from("orgs")
    .select("*")
    .eq("id", orgId)
    .single();
  if (error) return null;
  return data;
}

export async function updateOrg(fields: { name?: string }) {
  const orgId = await getOrgId();
  if (!orgId) return;
  await supabase.from("orgs").update(fields).eq("id", orgId);
}

// ───── Integrations / Knowledge / Numbers ─────

export async function listIntegrations() {
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

export async function listKnowledgeSources() {
  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

export async function createKnowledgeSource(fields: { kind: string; title: string; uri: string }) {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("knowledge_sources")
    .insert({
      org_id: orgId,
      kind: fields.kind,
      title: fields.title,
      uri: fields.uri,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listPhoneNumbers() {
  const { data, error } = await supabase
    .from("phone_numbers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

// ───── Vertical Configs ─────

export async function listVerticals() {
  const { data, error } = await supabase
    .from("vertical_configs")
    .select("*")
    .eq("enabled", true);
  if (error) return [];
  return data || [];
}

// ───── Webhook Endpoints ─────

export async function listWebhookEndpoints() {
  const orgId = await getOrgId();
  if (!orgId) return [];
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

export async function createWebhookEndpoint(fields: { url: string; events: string[] }) {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .insert({ org_id: orgId, url: fields.url, events: fields.events, enabled: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ───── Notifications ─────

export async function getNotificationPrefs() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;
  const userId = session.session.user.id;
  const { data, error } = await supabase
    .from("user_notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data?.prefs || { usage_alerts: true, failed_calls: true, campaign_completed: true };
}

export async function updateNotificationPrefs(prefs: Record<string, boolean>) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return;
  const userId = session.session.user.id;
  await supabase
    .from("user_notification_prefs")
    .upsert({ user_id: userId, prefs }, { onConflict: "user_id" });
}

// ───── Agent Presets ─────

export async function listAgentPresets(verticalKey?: string) {
  let query = supabase
    .from("agent_presets")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (verticalKey) {
    query = query.eq("vertical_key", verticalKey);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getAgentPreset(id: string) {
  const { data, error } = await supabase
    .from("agent_presets")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ───── Voice Catalog ─────

export async function listVoices(opts?: { gender?: string; language?: string; search?: string }) {
  let query = supabase
    .from("voice_catalog")
    .select("*")
    .order("name", { ascending: true });
  if (opts?.gender) {
    query = query.eq("gender", opts.gender);
  }
  if (opts?.language) {
    query = query.contains("language_codes", [opts.language]);
  }
  if (opts?.search) {
    query = query.or(`name.ilike.%${opts.search}%,description.ilike.%${opts.search}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Pull the latest voice library from ElevenLabs (via the `voice-sync` edge
 * function) and upsert it into voice_catalog. Admin/owner only.
 */
export async function syncVoices(): Promise<{ count: number }> {
  const { data, error } = await supabase.functions.invoke("voice-sync", {
    body: {},
  });
  if (error) {
    // Surface the function's JSON error message when available.
    const ctx = (error as any).context;
    let message = error.message;
    try {
      const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message || "Voice sync failed");
  }
  return { count: data?.count ?? 0 };
}

// ───── Integration Catalog ─────

export async function listIntegrationCatalog(opts?: { category?: string; vertical?: string }) {
  let query = supabase
    .from("integration_catalog")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (opts?.category) {
    query = query.eq("category", opts.category);
  }
  if (opts?.vertical) {
    query = query.contains("verticals", [opts.vertical]);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getIntegrationCatalogEntry(providerKey: string) {
  const { data, error } = await supabase
    .from("integration_catalog")
    .select("*")
    .eq("provider_key", providerKey)
    .single();
  if (error) throw error;
  return data;
}

// ───── Integration Bridge Config ─────

export async function listBridgeConfigs() {
  const { data, error } = await supabase
    .from("integration_bridge_config")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

export async function getBridgeConfig(providerKey: string) {
  const orgId = await getOrgId();
  if (!orgId) return null;
  const { data, error } = await supabase
    .from("integration_bridge_config")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider_key", providerKey)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function upsertBridgeConfig(providerKey: string, fields: {
  status?: string;
  config?: Record<string, any>;
  secret_ref?: string;
  scopes_granted?: string[];
  error_message?: string | null;
}) {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("integration_bridge_config")
    .upsert(
      {
        org_id: orgId,
        provider_key: providerKey,
        ...fields,
        connected_at: fields.status === "active" ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider_key" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function disconnectIntegration(providerKey: string) {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("integration_bridge_config")
    .update({ status: "disconnected", updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("provider_key", providerKey);
  if (error) throw error;
}

// ───── Shopify Connections ─────

export async function getShopifyConnection() {
  const orgId = await getOrgId();
  if (!orgId) return null;
  const { data, error } = await supabase
    .from("shopify_connections")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function createShopifyConnection(fields: { shop_domain: string }) {
  const orgId = await getOrgId();
  if (!orgId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("shopify_connections")
    .insert({
      org_id: orgId,
      shop_domain: fields.shop_domain,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateShopifyConnection(id: string, fields: Record<string, any>) {
  const { data, error } = await supabase
    .from("shopify_connections")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

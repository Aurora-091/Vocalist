import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BridgeRequest {
  provider: string;
  action: string;
  params?: Record<string, any>;
}

const FETCH_TIMEOUT_MS = 15_000;

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

const PROVIDER_HANDLERS: Record<string, (action: string, params: Record<string, any>, config: any, secret: any) => Promise<any>> = {
  shopify: handleShopify,
  hubspot: handleHubspot,
  pipedrive: handlePipedrive,
  freshsales: handleFreshsales,
  cliniko: handleCliniko,
  jane_app: handleJaneApp,
  google_cal: handleGoogleCalendar,
  calcom: handleCalcom,
  whatsapp: handleWhatsApp,
  zoho_crm: handleZohoCrm,
  salesforce: handleSalesforce,
  drchrono: handleDrChrono,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const orgId = user.app_metadata?.org_id;
    if (!orgId) {
      return jsonResponse({ error: "No org_id in user metadata" }, 403);
    }

    const body: BridgeRequest = await req.json();
    const { provider, action, params = {} } = body;

    if (!provider || !action) {
      return jsonResponse({ error: "provider and action are required" }, 400);
    }

    const handler = PROVIDER_HANDLERS[provider];
    if (!handler) {
      return jsonResponse({ error: `Unsupported provider: ${provider}` }, 400);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: bridgeConfig } = await adminClient
      .from("integration_bridge_config")
      .select("*")
      .eq("org_id", orgId)
      .eq("provider_key", provider)
      .eq("status", "active")
      .maybeSingle();

    if (!bridgeConfig) {
      return jsonResponse({ error: `No active ${provider} connection found` }, 404);
    }

    let decryptedSecret: string | null = null;
    if (bridgeConfig.secret_ref) {
      const { data: secret } = await adminClient
        .from("vault.decrypted_secrets")
        .select("decrypted_secret")
        .eq("name", bridgeConfig.secret_ref)
        .maybeSingle();
      decryptedSecret = secret?.decrypted_secret || null;
    }

    const secretRequiredProviders = ["shopify", "hubspot", "pipedrive", "freshsales", "cliniko", "jane_app", "calcom", "whatsapp"];
    if (secretRequiredProviders.includes(provider) && !decryptedSecret) {
      return jsonResponse({ error: `Credentials secret not configured for ${provider}` }, 422);
    }

    const result = await handler(action, params, bridgeConfig, decryptedSecret);

    return jsonResponse({ data: result, provider, action });
  } catch (err) {
    console.error("Agent bridge execution failed:", err);
    return jsonResponse({ error: "Internal bridge error" }, 500);
  }
});

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Provider Handlers ───

async function handleShopify(action: string, params: Record<string, any>, config: any, apiKey: string) {
  const domain = config.config?.shop_domain;

  if (!domain || !apiKey) throw new Error("Shopify not configured properly");

  const pathMap: Record<string, string> = {
    get_order: `/admin/api/2024-01/orders/${params.order_id}.json`,
    list_orders: `/admin/api/2024-01/orders.json?status=any&limit=${params.limit || 10}`,
    get_customer: `/admin/api/2024-01/customers/${params.customer_id}.json`,
    search_customers: `/admin/api/2024-01/customers/search.json?query=${encodeURIComponent(params.query || "")}`,
    get_product: `/admin/api/2024-01/products/${params.product_id}.json`,
    get_cart: `/admin/api/2024-01/checkouts/${params.checkout_id}.json`,
  };

  const path = pathMap[action];
  if (!path) throw new Error(`Unknown Shopify action: ${action}`);

  const res = await fetchWithTimeout(`https://${domain}${path}`, {
    headers: { "X-Shopify-Access-Token": apiKey, "Content-Type": "application/json" },
  });

  if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);
  return await res.json();
}

async function handleHubspot(action: string, params: Record<string, any>, config: any, token: string) {
  if (!token) throw new Error("HubSpot not configured");

  const baseUrl = "https://api.hubapi.com";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const routes: Record<string, () => Promise<any>> = {
    get_contact: async () => {
      const res = await fetchWithTimeout(`${baseUrl}/crm/v3/objects/contacts/${params.contact_id}`, { headers });
      if (!res.ok) throw new Error(`HubSpot error: ${res.status}`);
      return res.json();
    },
    search_contacts: async () => {
      const res = await fetchWithTimeout(`${baseUrl}/crm/v3/objects/contacts/search`, {
        method: "POST",
        headers,
        body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: params.email }] }] }),
      });
      if (!res.ok) throw new Error(`HubSpot error: ${res.status}`);
      return res.json();
    },
    create_note: async () => {
      const res = await fetchWithTimeout(`${baseUrl}/crm/v3/objects/notes`, {
        method: "POST",
        headers,
        body: JSON.stringify({ properties: { hs_note_body: params.note, hs_timestamp: new Date().toISOString() } }),
      });
      if (!res.ok) throw new Error(`HubSpot error: ${res.status}`);
      return res.json();
    },
  };

  const handler = routes[action];
  if (!handler) throw new Error(`Unknown HubSpot action: ${action}`);
  return await handler();
}

async function handlePipedrive(action: string, params: Record<string, any>, config: any, token: string) {
  const domain = config.config?.domain || "api";
  if (!token) throw new Error("Pipedrive not configured");

  const baseUrl = `https://${domain}.pipedrive.com/api/v1`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const routes: Record<string, string> = {
    get_person: `/persons/${params.person_id}`,
    search_persons: `/persons/search?term=${encodeURIComponent(params.query || "")}`,
    get_deal: `/deals/${params.deal_id}`,
    list_deals: `/deals?status=open&limit=${params.limit || 10}`,
  };

  const path = routes[action];
  if (!path) throw new Error(`Unknown Pipedrive action: ${action}`);

  const res = await fetchWithTimeout(`${baseUrl}${path}`, { headers });
  if (!res.ok) throw new Error(`Pipedrive error: ${res.status}`);
  return await res.json();
}

async function handleFreshsales(action: string, params: Record<string, any>, config: any, token: string) {
  const domain = config.config?.domain;
  if (!token || !domain) throw new Error("Freshsales not configured");

  const baseUrl = `https://${domain}.freshsales.io/api`;
  const headers = { Authorization: `Token token=${token}`, "Content-Type": "application/json" };

  const routes: Record<string, string> = {
    get_contact: `/contacts/${params.contact_id}`,
    search_contacts: `/lookup?q=${encodeURIComponent(params.query || "")}&f=email&entities=contact`,
    get_deal: `/deals/${params.deal_id}`,
  };

  const path = routes[action];
  if (!path) throw new Error(`Unknown Freshsales action: ${action}`);

  const res = await fetchWithTimeout(`${baseUrl}${path}`, { headers });
  if (!res.ok) throw new Error(`Freshsales error: ${res.status}`);
  return await res.json();
}

async function handleCliniko(action: string, params: Record<string, any>, config: any, apiKey: string) {
  if (!apiKey) throw new Error("Cliniko not configured");

  const baseUrl = "https://api.au1.cliniko.com/v1";
  const headers = {
    Authorization: `Basic ${btoa(apiKey + ":")}`,
    Accept: "application/json",
    "User-Agent": "Aurora (support@aurora.ai)",
  };

  const routes: Record<string, string> = {
    get_patient: `/patients/${params.patient_id}`,
    search_patients: `/patients?q[]=first_name~${encodeURIComponent(params.query || "")}`,
    list_appointments: `/appointments?q[]=starts_at>=${params.from || new Date().toISOString()}&page_size=${params.limit || 20}`,
    get_practitioners: `/practitioners`,
  };

  const path = routes[action];
  if (!path) throw new Error(`Unknown Cliniko action: ${action}`);

  const res = await fetchWithTimeout(`${baseUrl}${path}`, { headers });
  if (!res.ok) throw new Error(`Cliniko error: ${res.status}`);
  return await res.json();
}

async function handleJaneApp(action: string, params: Record<string, any>, config: any, apiKey: string) {
  const domain = config.config?.domain;
  if (!apiKey || !domain) throw new Error("Jane App not configured");

  const baseUrl = `https://${domain}.janeapp.com/api/v1`;
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const routes: Record<string, string> = {
    get_patient: `/patients/${params.patient_id}`,
    search_patients: `/patients?query=${encodeURIComponent(params.query || "")}`,
    list_appointments: `/appointments?start_at=${params.from || new Date().toISOString()}&limit=${params.limit || 20}`,
    get_staff: `/staff`,
  };

  const path = routes[action];
  if (!path) throw new Error(`Unknown Jane App action: ${action}`);

  const res = await fetchWithTimeout(`${baseUrl}${path}`, { headers });
  if (!res.ok) throw new Error(`Jane App error: ${res.status}`);
  return await res.json();
}

async function handleGoogleCalendar(action: string, params: Record<string, any>, config: any, _secret: string | null) {
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: tokenRow } = await adminClient
    .from("oauth_tokens")
    .select("*")
    .eq("org_id", config.org_id)
    .eq("provider_key", "google_cal")
    .maybeSingle();

  if (!tokenRow) throw new Error("Google Calendar not authorized");

  let accessToken = tokenRow.access_token;
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    accessToken = await refreshGoogleToken(tokenRow, adminClient);
  }

  const baseUrl = "https://www.googleapis.com/calendar/v3";
  const headers = { Authorization: `Bearer ${accessToken}` };
  const calendarId = params.calendar_id || "primary";

  const routes: Record<string, () => Promise<any>> = {
    list_events: async () => {
      const timeMin = params.time_min || new Date().toISOString();
      const timeMax = params.time_max || new Date(Date.now() + 7 * 86400000).toISOString();
      const res = await fetchWithTimeout(`${baseUrl}/calendars/${calendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, { headers });
      if (!res.ok) throw new Error(`Google Calendar error: ${res.status}`);
      return res.json();
    },
    get_freebusy: async () => {
      const res = await fetchWithTimeout(`${baseUrl}/freeBusy`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          timeMin: params.time_min || new Date().toISOString(),
          timeMax: params.time_max || new Date(Date.now() + 86400000).toISOString(),
          items: [{ id: calendarId }],
        }),
      });
      if (!res.ok) throw new Error(`Google Calendar error: ${res.status}`);
      return res.json();
    },
    create_event: async () => {
      const res = await fetchWithTimeout(`${baseUrl}/calendars/${calendarId}/events`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: params.summary,
          description: params.description || "",
          start: { dateTime: params.start_time, timeZone: params.timezone || "UTC" },
          end: { dateTime: params.end_time, timeZone: params.timezone || "UTC" },
          attendees: params.attendees?.map((email: string) => ({ email })) || [],
        }),
      });
      if (!res.ok) throw new Error(`Google Calendar error: ${res.status}`);
      return res.json();
    },
  };

  const handler = routes[action];
  if (!handler) throw new Error(`Unknown Google Calendar action: ${action}`);
  return await handler();
}

async function handleCalcom(action: string, params: Record<string, any>, config: any, apiKey: string) {
  if (!apiKey) throw new Error("Cal.com not configured");

  const baseUrl = "https://api.cal.com/v1";
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  const routes: Record<string, string> = {
    list_event_types: `/event-types`,
    get_availability: `/availability?dateFrom=${params.date_from || ""}&dateTo=${params.date_to || ""}`,
    list_bookings: `/bookings?status=${params.status || "upcoming"}`,
  };

  const path = routes[action];
  if (!path) throw new Error(`Unknown Cal.com action: ${action}`);

  const res = await fetchWithTimeout(`${baseUrl}${path}`, { headers });
  if (!res.ok) throw new Error(`Cal.com error: ${res.status}`);
  return await res.json();
}

async function handleWhatsApp(action: string, params: Record<string, any>, config: any, decryptedSecret: string) {
  const accountSid = config.config?.account_sid;
  const authToken = decryptedSecret;
  const fromNumber = config.config?.whatsapp_number;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("WhatsApp/Twilio not configured");
  }

  if (action === "send_message") {
    const to = params.to;
    const body = params.body;
    if (!to || !body) throw new Error("to and body are required");

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const formData = new URLSearchParams();
    formData.append("To", `whatsapp:${to}`);
    formData.append("From", `whatsapp:${fromNumber}`);
    formData.append("Body", body);

    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(accountSid + ":" + authToken)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!res.ok) throw new Error(`Twilio error: ${res.status}`);
    return await res.json();
  }

  throw new Error(`Unknown WhatsApp action: ${action}`);
}

async function refreshGoogleToken(tokenRow: any, adminClient: any): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret || !tokenRow.refresh_token) {
    throw new Error("Cannot refresh Google token — missing credentials");
  }

  // 1. Re-read the oauth_tokens row to check if another process already refreshed it while we were waiting.
  const { data: currentToken } = await adminClient
    .from("oauth_tokens")
    .select("*")
    .eq("id", tokenRow.id)
    .maybeSingle();

  if (currentToken && currentToken.expires_at && new Date(currentToken.expires_at) > new Date()) {
    // Already refreshed! Return the new token.
    return currentToken.access_token;
  }

  const res = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!res.ok) throw new Error("Failed to refresh Google token");

  const data = await res.json();
  const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  
  const originalUpdatedAt = currentToken ? currentToken.updated_at : tokenRow.updated_at;

  const { data: updatedRows, error } = await adminClient
    .from("oauth_tokens")
    .update({
      access_token: data.access_token,
      expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenRow.id)
    .eq("updated_at", originalUpdatedAt)
    .select();

  if (error || !updatedRows || updatedRows.length === 0) {
    // Conflict! Another request won the race. Fetch the new token.
    const { data: winnerToken } = await adminClient
      .from("oauth_tokens")
      .select("access_token")
      .eq("id", tokenRow.id)
      .maybeSingle();
      
    if (winnerToken) {
      return winnerToken.access_token;
    }
  }

  return data.access_token;
}

// ─── Generic OAuth token refresh ───

async function refreshOAuthToken(
  tokenRow: any,
  adminClient: any,
  tokenUrl: string,
  clientIdEnv: string,
  clientSecretEnv: string,
  extraParams?: Record<string, string>
): Promise<string> {
  if (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date()) {
    return tokenRow.access_token;
  }

  const clientId = Deno.env.get(clientIdEnv);
  const clientSecret = Deno.env.get(clientSecretEnv);
  if (!clientId || !clientSecret || !tokenRow.refresh_token) {
    throw new Error(`Cannot refresh token — missing ${clientIdEnv}/${clientSecretEnv} or refresh_token`);
  }

  // Optimistic check — another process may have already refreshed
  const { data: current } = await adminClient
    .from("oauth_tokens")
    .select("*")
    .eq("id", tokenRow.id)
    .maybeSingle();
  if (current?.expires_at && new Date(current.expires_at) > new Date()) {
    return current.access_token;
  }

  const params: Record<string, string> = {
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokenRow.refresh_token,
    ...extraParams,
  };

  const res = await fetchWithTimeout(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed for ${tokenUrl}: ${res.status}`);

  const data = await res.json();
  const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  const { data: updated, error } = await adminClient
    .from("oauth_tokens")
    .update({
      access_token: data.access_token,
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
      expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenRow.id)
    .eq("updated_at", (current || tokenRow).updated_at)
    .select();

  if (error || !updated || updated.length === 0) {
    const { data: winner } = await adminClient
      .from("oauth_tokens")
      .select("access_token")
      .eq("id", tokenRow.id)
      .maybeSingle();
    if (winner) return winner.access_token;
  }

  return data.access_token;
}

// ─── Zoho CRM ───

async function handleZohoCrm(action: string, params: Record<string, any>, config: any, _secret: string | null) {
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: tokenRow } = await adminClient
    .from("oauth_tokens")
    .select("*")
    .eq("org_id", config.org_id)
    .eq("provider_key", "zoho_crm")
    .maybeSingle();
  if (!tokenRow) throw new Error("Zoho CRM not authorized");

  const accessToken = await refreshOAuthToken(
    tokenRow,
    adminClient,
    "https://accounts.zoho.com/oauth/v2/token",
    "ZOHO_CLIENT_ID",
    "ZOHO_CLIENT_SECRET"
  );

  const apiDomain = tokenRow.metadata?.api_domain || "https://www.zohoapis.com";
  const baseUrl = `${apiDomain}/crm/v7`;
  const headers = { Authorization: `Zoho-oauthtoken ${accessToken}`, "Content-Type": "application/json" };

  const routes: Record<string, () => Promise<any>> = {
    search_contacts: async () => {
      const term = params.query || params.email || params.phone || "";
      const res = await fetchWithTimeout(
        `${baseUrl}/Contacts/search?word=${encodeURIComponent(term)}&fields=First_Name,Last_Name,Email,Phone`,
        { headers }
      );
      if (!res.ok) throw new Error(`Zoho CRM error: ${res.status}`);
      return res.json();
    },
    get_contact: async () => {
      const res = await fetchWithTimeout(`${baseUrl}/Contacts/${params.contact_id}`, { headers });
      if (!res.ok) throw new Error(`Zoho CRM error: ${res.status}`);
      return res.json();
    },
    list_leads: async () => {
      const res = await fetchWithTimeout(
        `${baseUrl}/Leads?fields=First_Name,Last_Name,Email,Phone,Lead_Status&per_page=${params.limit || 20}`,
        { headers }
      );
      if (!res.ok) throw new Error(`Zoho CRM error: ${res.status}`);
      return res.json();
    },
    create_note: async () => {
      const body = {
        data: [{
          Note_Content: params.note,
          Note_Title: "Call Note",
          Parent_Id: params.contact_id || params.lead_id,
          se_module: params.contact_id ? "Contacts" : "Leads",
        }],
      };
      const res = await fetchWithTimeout(`${baseUrl}/Notes`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Zoho CRM error: ${res.status}`);
      return res.json();
    },
    update_contact: async () => {
      const body = { data: [{ id: params.contact_id, ...params.fields }] };
      const res = await fetchWithTimeout(`${baseUrl}/Contacts`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Zoho CRM error: ${res.status}`);
      return res.json();
    },
  };

  const handler = routes[action];
  if (!handler) throw new Error(`Unknown Zoho CRM action: ${action}`);
  return await handler();
}

// ─── Salesforce ───

async function handleSalesforce(action: string, params: Record<string, any>, config: any, _secret: string | null) {
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: tokenRow } = await adminClient
    .from("oauth_tokens")
    .select("*")
    .eq("org_id", config.org_id)
    .eq("provider_key", "salesforce")
    .maybeSingle();
  if (!tokenRow) throw new Error("Salesforce not authorized");

  const instanceUrl = tokenRow.metadata?.instance_url;
  if (!instanceUrl) throw new Error("Salesforce instance_url not found in token metadata");

  const accessToken = await refreshOAuthToken(
    tokenRow,
    adminClient,
    `${instanceUrl}/services/oauth2/token`,
    "SALESFORCE_CLIENT_ID",
    "SALESFORCE_CLIENT_SECRET"
  );

  const apiBase = `${instanceUrl}/services/data/v60.0`;
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  const routes: Record<string, () => Promise<any>> = {
    query: async () => {
      const soql = params.soql || `SELECT Id,FirstName,LastName,Email,Phone FROM Contact LIMIT ${params.limit || 10}`;
      const res = await fetchWithTimeout(`${apiBase}/query?q=${encodeURIComponent(soql)}`, { headers });
      if (!res.ok) throw new Error(`Salesforce error: ${res.status}`);
      return res.json();
    },
    search_contacts: async () => {
      const q = params.query || params.email || params.name || "";
      const sosl = `FIND {${q}} IN NAME FIELDS RETURNING Contact(Id,FirstName,LastName,Email,Phone)`;
      const res = await fetchWithTimeout(`${apiBase}/search?q=${encodeURIComponent(sosl)}`, { headers });
      if (!res.ok) throw new Error(`Salesforce error: ${res.status}`);
      return res.json();
    },
    get_contact: async () => {
      const res = await fetchWithTimeout(`${apiBase}/sobjects/Contact/${params.contact_id}`, { headers });
      if (!res.ok) throw new Error(`Salesforce error: ${res.status}`);
      return res.json();
    },
    create_task: async () => {
      const body: Record<string, any> = {
        Subject: params.subject || "Call",
        Description: params.description || "",
        Status: "Completed",
        ActivityDate: params.activity_date || new Date().toISOString().split("T")[0],
      };
      if (params.who_id) body.WhoId = params.who_id;
      if (params.call_duration) body.CallDurationInSeconds = params.call_duration;
      const res = await fetchWithTimeout(`${apiBase}/sobjects/Task`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Salesforce error: ${res.status}`);
      return res.json();
    },
    update_contact: async () => {
      const { contact_id, ...fields } = params;
      const res = await fetchWithTimeout(`${apiBase}/sobjects/Contact/${contact_id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(fields),
      });
      return { ok: res.ok, status: res.status };
    },
  };

  const handler = routes[action];
  if (!handler) throw new Error(`Unknown Salesforce action: ${action}`);
  return await handler();
}

// ─── DrChrono ───

async function handleDrChrono(action: string, params: Record<string, any>, config: any, _secret: string | null) {
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: tokenRow } = await adminClient
    .from("oauth_tokens")
    .select("*")
    .eq("org_id", config.org_id)
    .eq("provider_key", "drchrono")
    .maybeSingle();
  if (!tokenRow) throw new Error("DrChrono not authorized");

  const accessToken = await refreshOAuthToken(
    tokenRow,
    adminClient,
    "https://drchrono.com/o/token/",
    "DRCHRONO_CLIENT_ID",
    "DRCHRONO_CLIENT_SECRET"
  );

  const baseUrl = "https://drchrono.com/api";
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  const routes: Record<string, () => Promise<any>> = {
    get_patient: async () => {
      const res = await fetchWithTimeout(`${baseUrl}/patients/${params.patient_id}`, { headers });
      if (!res.ok) throw new Error(`DrChrono error: ${res.status}`);
      return res.json();
    },
    search_patients: async () => {
      const res = await fetchWithTimeout(
        `${baseUrl}/patients?search=${encodeURIComponent(params.query || "")}`,
        { headers }
      );
      if (!res.ok) throw new Error(`DrChrono error: ${res.status}`);
      return res.json();
    },
    list_appointments: async () => {
      const p = new URLSearchParams({ page_size: String(params.limit || 20) });
      if (params.patient_id) p.set("patient", String(params.patient_id));
      if (params.from) p.set("date_range", params.from);
      const res = await fetchWithTimeout(`${baseUrl}/appointments?${p}`, { headers });
      if (!res.ok) throw new Error(`DrChrono error: ${res.status}`);
      return res.json();
    },
    get_appointment: async () => {
      const res = await fetchWithTimeout(`${baseUrl}/appointments/${params.appointment_id}`, { headers });
      if (!res.ok) throw new Error(`DrChrono error: ${res.status}`);
      return res.json();
    },
    get_doctors: async () => {
      const res = await fetchWithTimeout(`${baseUrl}/doctors`, { headers });
      if (!res.ok) throw new Error(`DrChrono error: ${res.status}`);
      return res.json();
    },
    update_appointment: async () => {
      const { appointment_id, ...fields } = params;
      const res = await fetchWithTimeout(`${baseUrl}/appointments/${appointment_id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(fields),
      });
      return { ok: res.ok, status: res.status };
    },
  };

  const handler = routes[action];
  if (!handler) throw new Error(`Unknown DrChrono action: ${action}`);
  return await handler();
}

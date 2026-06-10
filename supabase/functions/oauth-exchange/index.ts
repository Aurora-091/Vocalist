import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TokenExchangeRequest {
  code: string;
  provider: string;
  redirect_uri: string;
}

const PROVIDER_CONFIG: Record<string, {
  token_url: string;
  client_id_env: string;
  client_secret_env: string;
  extra_params?: Record<string, string>;
}> = {
  google_cal: {
    token_url: "https://oauth2.googleapis.com/token",
    client_id_env: "GOOGLE_CLIENT_ID",
    client_secret_env: "GOOGLE_CLIENT_SECRET",
  },
  google_sheets: {
    token_url: "https://oauth2.googleapis.com/token",
    client_id_env: "GOOGLE_CLIENT_ID",
    client_secret_env: "GOOGLE_CLIENT_SECRET",
  },
  hubspot: {
    token_url: "https://api.hubapi.com/oauth/v1/token",
    client_id_env: "HUBSPOT_CLIENT_ID",
    client_secret_env: "HUBSPOT_CLIENT_SECRET",
  },
  zoho_crm: {
    token_url: "https://accounts.zoho.com/oauth/v2/token",
    client_id_env: "ZOHO_CLIENT_ID",
    client_secret_env: "ZOHO_CLIENT_SECRET",
  },
  salesforce: {
    token_url: "https://login.salesforce.com/services/oauth2/token",
    client_id_env: "SALESFORCE_CLIENT_ID",
    client_secret_env: "SALESFORCE_CLIENT_SECRET",
  },
  drchrono: {
    token_url: "https://drchrono.com/o/token/",
    client_id_env: "DRCHRONO_CLIENT_ID",
    client_secret_env: "DRCHRONO_CLIENT_SECRET",
  },
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

    const body: TokenExchangeRequest = await req.json();
    const { code, provider, redirect_uri } = body;

    if (!code || !provider || !redirect_uri) {
      return jsonResponse({ error: "code, provider, and redirect_uri are required" }, 400);
    }

    const config = PROVIDER_CONFIG[provider];
    if (!config) {
      return jsonResponse({ error: `Unsupported OAuth provider: ${provider}` }, 400);
    }

    const clientId = Deno.env.get(config.client_id_env);
    const clientSecret = Deno.env.get(config.client_secret_env);

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: `OAuth credentials not configured for ${provider}` }, 500);
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri,
      client_id: clientId,
      client_secret: clientSecret,
      ...(config.extra_params || {}),
    });

    const tokenRes = await fetch(config.token_url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => "");
      return jsonResponse({ error: `Token exchange failed (${tokenRes.status})`, detail: errText.slice(0, 300) }, 400);
    }

    const tokenData = await tokenRes.json();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    await adminClient.from("oauth_tokens").upsert(
      {
        org_id: orgId,
        provider_key: provider,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_type: tokenData.token_type || "Bearer",
        expires_at: expiresAt,
        scopes: tokenData.scope ? tokenData.scope.split(/[\s,]+/) : [],
        raw_response: tokenData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider_key" }
    );

    await adminClient.from("integration_bridge_config").upsert(
      {
        org_id: orgId,
        provider_key: provider,
        status: "active",
        scopes_granted: tokenData.scope ? tokenData.scope.split(/[\s,]+/) : [],
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider_key" }
    );

    return jsonResponse({
      success: true,
      scopes: tokenData.scope ? tokenData.scope.split(/[\s,]+/) : [],
    });
  } catch (err) {
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
});

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

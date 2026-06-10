import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExportRequest {
  export_type: "calls" | "campaigns" | "contacts";
  spreadsheet_id?: string;
  sheet_name?: string;
  date_from?: string;
  date_to?: string;
}

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
      return jsonResponse({ error: "No org_id" }, 403);
    }

    const body: ExportRequest = await req.json();
    const { export_type, spreadsheet_id, sheet_name, date_from, date_to } = body;

    if (!export_type) {
      return jsonResponse({ error: "export_type is required" }, 400);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get OAuth token for Google Sheets
    const { data: tokenRow } = await adminClient
      .from("oauth_tokens")
      .select("*")
      .eq("org_id", orgId)
      .eq("provider_key", "google_sheets")
      .maybeSingle();

    if (!tokenRow) {
      return jsonResponse({ error: "Google Sheets not connected" }, 404);
    }

    let accessToken = tokenRow.access_token;
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      accessToken = await refreshToken(tokenRow, adminClient);
    }

    // Fetch data to export
    const rows = await fetchExportData(adminClient, orgId, export_type, date_from, date_to);

    if (rows.length === 0) {
      return jsonResponse({ error: "No data to export for the selected range" }, 404);
    }

    // Create or append to spreadsheet
    const headers = Object.keys(rows[0]);
    const values = [headers, ...rows.map((r) => headers.map((h) => String(r[h] ?? "")))];

    let sheetId = spreadsheet_id;

    if (!sheetId) {
      // Create new spreadsheet
      const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: { title: `Aurora Export - ${export_type} - ${new Date().toISOString().split("T")[0]}` },
          sheets: [{ properties: { title: sheet_name || export_type } }],
        }),
      });

      if (!createRes.ok) throw new Error(`Failed to create spreadsheet: ${createRes.status}`);
      const createData = await createRes.json();
      sheetId = createData.spreadsheetId;
    }

    // Write data
    const range = `${sheet_name || export_type}!A1`;
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ range, majorDimension: "ROWS", values }),
      }
    );

    if (!updateRes.ok) throw new Error(`Failed to write data: ${updateRes.status}`);

    return jsonResponse({
      success: true,
      spreadsheet_id: sheetId,
      spreadsheet_url: `https://docs.google.com/spreadsheets/d/${sheetId}`,
      rows_exported: rows.length,
    });
  } catch (err) {
    return jsonResponse({ error: err.message || "Export failed" }, 500);
  }
});

async function fetchExportData(
  client: any,
  orgId: string,
  exportType: string,
  dateFrom?: string,
  dateTo?: string
): Promise<Record<string, any>[]> {
  const from = dateFrom || new Date(Date.now() - 30 * 86400000).toISOString();
  const to = dateTo || new Date().toISOString();

  switch (exportType) {
    case "calls": {
      const { data } = await client
        .from("calls")
        .select("id, direction, status, duration_sec, sentiment, created_at, ended_at")
        .eq("org_id", orgId)
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false })
        .limit(1000);
      return data || [];
    }
    case "contacts": {
      const { data } = await client
        .from("contacts")
        .select("id, name, e164, email, source, consent_status, created_at")
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1000);
      return data || [];
    }
    case "campaigns": {
      const { data } = await client
        .from("campaigns")
        .select("id, name, status, concurrency, max_retries, created_at")
        .eq("org_id", orgId)
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    }
    default:
      return [];
  }
}

async function refreshToken(tokenRow: any, adminClient: any): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret || !tokenRow.refresh_token) {
    throw new Error("Cannot refresh Google token");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!res.ok) throw new Error("Token refresh failed");

  const data = await res.json();
  await adminClient
    .from("oauth_tokens")
    .update({
      access_token: data.access_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenRow.id);

  return data.access_token;
}

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

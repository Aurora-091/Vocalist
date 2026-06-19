import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { shop_domain, api_key } = body;

    if (!shop_domain || !api_key) {
      return new Response(
        JSON.stringify({ error: "shop_domain and api_key are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the API key against Shopify
    const shopifyUrl = `https://${shop_domain}/admin/api/2024-01/shop.json`;
    const shopifyRes = await fetch(shopifyUrl, {
      headers: {
        "X-Shopify-Access-Token": api_key,
        "Content-Type": "application/json",
      },
    });

    if (!shopifyRes.ok) {
      const errText = await shopifyRes.text().catch(() => "");
      return new Response(
        JSON.stringify({
          error: `Shopify API validation failed (${shopifyRes.status}). Check your API key and domain.`,
          detail: errText.slice(0, 200),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shopData = await shopifyRes.json();
    const shopName = shopData?.shop?.name || shop_domain;

    // Store API key securely using service role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const keyRef = `shopify_key_${user.app_metadata?.org_id || user.id}`;

    // Store in vault
    await adminClient.rpc("vault_store", {
      name: keyRef,
      secret: api_key,
    });

    await adminClient.from("shopify_connections").upsert(
      {
        org_id: user.app_metadata?.org_id,
        shop_domain,
        api_key_ref: keyRef,
        status: "active",
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: "org_id" }
    );

    return new Response(
      JSON.stringify({
        success: true,
        shop_name: shopName,
        shop_domain,
        key_ref: keyRef,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

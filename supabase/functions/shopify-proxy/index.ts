import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CACHE_TTL: Record<string, number> = {
  order: 300,
  orders: 300,
  cart: 120,
  customer: 900,
  product: 3600,
  default: 300,
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

    const orgId = user.app_metadata?.org_id;
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "No org_id in user metadata" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Expected paths: /shopify-proxy/order/123, /shopify-proxy/cart/abc, etc.
    const resourceType = pathParts[1] || "default";
    const resourceId = pathParts[2] || "";
    const searchParams = url.searchParams.toString();

    const cacheKey = `${resourceType}:${resourceId}${searchParams ? `?${searchParams}` : ""}`;

    // Check cache first
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: cached } = await adminClient
      .from("shopify_cache")
      .select("payload, expires_at")
      .eq("org_id", orgId)
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return new Response(
        JSON.stringify({ data: cached.payload, cached: true }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Cache": "HIT",
          },
        }
      );
    }

    // Cache miss — fetch from Shopify
    const { data: connection } = await adminClient
      .from("shopify_connections")
      .select("shop_domain, api_key_ref")
      .eq("org_id", orgId)
      .eq("status", "active")
      .maybeSingle();

    if (!connection) {
      return new Response(
        JSON.stringify({ error: "No active Shopify connection" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Shopify API path
    let shopifyPath = "";
    switch (resourceType) {
      case "order":
        shopifyPath = `/admin/api/2024-01/orders/${resourceId}.json`;
        break;
      case "orders":
        shopifyPath = `/admin/api/2024-01/orders.json?${searchParams}`;
        break;
      case "cart":
        shopifyPath = `/admin/api/2024-01/checkouts/${resourceId}.json`;
        break;
      case "customer":
        shopifyPath = `/admin/api/2024-01/customers/${resourceId}.json`;
        break;
      case "product":
        shopifyPath = `/admin/api/2024-01/products/${resourceId}.json`;
        break;
      default:
        shopifyPath = `/admin/api/2024-01/${resourceType}.json?${searchParams}`;
    }

    let apiKey: string | null = null;
    if (connection.api_key_ref) {
      const { data: secret } = await adminClient
        .from("vault.decrypted_secrets")
        .select("decrypted_secret")
        .eq("name", connection.api_key_ref)
        .maybeSingle();
      apiKey = secret?.decrypted_secret || null;
    }
    if (!apiKey) {
      apiKey = Deno.env.get("SHOPIFY_API_KEY") || null;
    }
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Shopify API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shopifyRes = await fetch(
      `https://${connection.shop_domain}${shopifyPath}`,
      {
        headers: {
          "X-Shopify-Access-Token": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!shopifyRes.ok) {
      const errText = await shopifyRes.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Shopify API error: ${shopifyRes.status}`, detail: errText.slice(0, 200) }),
        { status: shopifyRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shopifyData = await shopifyRes.json();

    // Store in cache
    const ttl = CACHE_TTL[resourceType] || CACHE_TTL.default;
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    await adminClient
      .from("shopify_cache")
      .upsert(
        {
          org_id: orgId,
          cache_key: cacheKey,
          payload: shopifyData,
          expires_at: expiresAt,
        },
        { onConflict: "org_id,cache_key" }
      );

    return new Response(
      JSON.stringify({ data: shopifyData, cached: false }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Cache": "MISS",
          "X-Cache-TTL": String(ttl),
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

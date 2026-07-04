import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(clientIp)) {
    return jsonResponse(
      { error: { code: "rate_limited", message: "Too many attempts. Please try again shortly." } },
      429
    );
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: { code: "invalid_json", message: "Invalid request body" } }, 400);
    }

    const { email, phone } = body;

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: { code: "validation_error", message: "Please provide a valid email and phone number" } }, 400);
    }
    if (!phone || typeof phone !== "string" || phone.trim().length < 7 || phone.trim().length > 20) {
      return jsonResponse({ error: { code: "validation_error", message: "Please provide a valid email and phone number" } }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Only allow update if the waitlist entry was created recently (within 30 minutes)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: existing } = await admin
      .from("waitlist")
      .select("id, created_at")
      .eq("email", email.trim())
      .gte("created_at", thirtyMinAgo)
      .maybeSingle();

    if (!existing) {
      return jsonResponse({ error: { code: "not_found", message: "Waitlist entry not found or expired" } }, 404);
    }

    const { error } = await admin
      .from("waitlist")
      .update({ phone: phone.trim() })
      .eq("id", existing.id);

    if (error) {
      console.error("Waitlist phone update failed", error);
      return jsonResponse({ error: { code: "internal", message: "Something went wrong" } }, 500);
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error("waitlist-phone error", err);
    return jsonResponse({ error: { code: "internal", message: "Something went wrong" } }, 500);
  }
});

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

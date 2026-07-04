import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
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

    const { error } = await admin
      .from("waitlist")
      .update({ phone: phone.trim() })
      .eq("email", email.trim());

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

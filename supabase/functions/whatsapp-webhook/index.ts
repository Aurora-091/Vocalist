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
    const body = await req.json();
    const { From, Body, MessageSid, AccountSid } = body;

    if (!From || !Body) {
      return new Response(
        JSON.stringify({ error: "Invalid webhook payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromNumber = From.replace("whatsapp:", "");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: configs } = await adminClient
      .from("integration_bridge_config")
      .select("org_id, config")
      .eq("provider_key", "whatsapp")
      .eq("status", "active");

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active WhatsApp integrations" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const matchingConfig = configs.find(
      (c: any) => c.config?.account_sid === AccountSid
    ) || configs[0];

    const orgId = matchingConfig.org_id;

    // Store inbound message
    await adminClient.from("whatsapp_messages").insert({
      org_id: orgId,
      direction: "inbound",
      from_number: fromNumber,
      to_number: matchingConfig.config?.whatsapp_number || "",
      body: Body,
      message_sid: MessageSid,
      status: "received",
    });

    // Look up contact by phone number
    const { data: contact } = await adminClient
      .from("contacts")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("e164", fromNumber)
      .maybeSingle();

    // Respond with TwiML acknowledgment
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

    return new Response(twiml, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Webhook processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

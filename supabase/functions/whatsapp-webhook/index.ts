import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function verifyTwilioWebhook(
  authToken: string,
  url: string,
  rawBody: string,
  sig: string | null,
  contentType: string
): Promise<boolean> {
  if (!authToken || !sig) return false;

  if (contentType.includes("application/json")) {
    const urlObj = new URL(url);
    const bodySHA256 = urlObj.searchParams.get("bodySHA256");
    if (!bodySHA256) return false;

    // Hash raw body
    const encoder = new TextEncoder();
    const data = encoder.encode(rawBody);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const calculatedHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    if (calculatedHash !== bodySHA256) return false;

    // Signature is computed on the exact URL
    const hmac = crypto.createHmac("sha1", authToken);
    hmac.update(url);
    const expected = hmac.digest("base64");

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
      return false;
    }
  } else {
    // x-www-form-urlencoded
    const params = Object.fromEntries(new URLSearchParams(rawBody).entries());
    const sortedKeys = Object.keys(params).sort();
    const data = url + sortedKeys.map((k) => `${k}${params[k]}`).join("");
    const hmac = crypto.createHmac("sha1", authToken);
    hmac.update(data);
    const expected = hmac.digest("base64");

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
      return false;
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = Object.fromEntries(new URLSearchParams(rawBody).entries());
    }

    const { From, Body, MessageSid, AccountSid } = body;

    if (!From || !Body || !AccountSid) {
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
      .select("org_id, config, secret_ref")
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

    if (!matchingConfig.secret_ref) {
      return new Response(
        JSON.stringify({ error: "WhatsApp credentials secret not configured" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Retrieve Twilio Auth Token from Vault
    const { data: secret } = await adminClient
      .from("vault.decrypted_secrets")
      .select("decrypted_secret")
      .eq("name", matchingConfig.secret_ref)
      .maybeSingle();

    const twilioAuthToken = secret?.decrypted_secret || null;
    if (!twilioAuthToken) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials secret not found in Vault" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify Twilio Signature
    const sig = req.headers.get("x-twilio-signature");
    const contentType = req.headers.get("content-type") || "";
    const isVerified = await verifyTwilioWebhook(twilioAuthToken, req.url, rawBody, sig, contentType);

    if (!isVerified) {
      return new Response(
        JSON.stringify({ error: "Invalid Twilio signature" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

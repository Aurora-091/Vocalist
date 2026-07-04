import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FROM_EMAIL = "Weeber <hello@weeber.ai>";

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildConfirmHtml(name: string): string {
  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const greeting = firstName ? `Hi ${escHtml(firstName)},` : "Hi,";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>We received your inquiry — Weeber</title></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F5F4F0;padding:48px 20px 32px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;">
<tr><td style="padding:0 0 28px;"><img src="https://weeber.ai/weeber_logo_transparent.png" alt="Weeber" width="108" style="display:block;border:0;filter:brightness(0);" /></td></tr>
<tr><td style="background:#FEFEFE;border:1px solid #E8E6E1;border-radius:3px;overflow:hidden;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td style="background:#0B0B0C;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:40px 40px 36px;">
<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#9A9AA0;text-transform:uppercase;letter-spacing:0.9px;">Enterprise</p>
<h1 style="margin:0 0 24px;font-size:26px;font-weight:800;color:#0B0B0C;line-height:1.15;letter-spacing:-0.4px;">${greeting} We've got your inquiry.</h1>
<p style="margin:0 0 20px;font-size:15px;color:#4A4A4F;line-height:1.75;">Thanks for reaching out. Our enterprise team reviews every inquiry personally and typically responds within one business day.</p>
<p style="margin:0 0 20px;font-size:15px;color:#4A4A4F;line-height:1.75;">We'll be in touch shortly to understand your setup in more detail and walk you through what Weeber can do for high-volume or regulated environments.</p>
<p style="margin:0;font-size:15px;color:#4A4A4F;line-height:1.75;">In the meantime, if you have an urgent question you can reach us directly at <a href="mailto:enterprise@weeber.ai" style="color:#0B0B0C;font-weight:600;text-decoration:none;">enterprise@weeber.ai</a>.</p>
</td></tr>
<tr><td style="padding:0 40px 40px;border-top:1px solid #ECEAE5;">
<p style="margin:20px 0 0;font-size:14px;color:#67676C;line-height:1.7;">Looking forward to speaking soon.</p>
<p style="margin:8px 0 0;font-size:14px;color:#0B0B0C;font-weight:600;">— The Weeber team</p>
</td></tr>
</table></td></tr>
<tr><td style="padding:24px 0 0;text-align:center;"><p style="margin:0;font-size:11px;color:#9A9AA0;">You received this because you submitted an enterprise inquiry at weeber.ai</p></td></tr>
</table></td></tr></table>
</body></html>`;
}

function buildConfirmText(name: string): string {
  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return `${greeting}\n\nWe've received your enterprise inquiry and our team will be in touch within one business day.\n\nIn the meantime you can reach us directly at enterprise@weeber.ai.\n\nLooking forward to speaking soon.\n\n— The Weeber team`;
}

async function sendConfirmation(email: string, name: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [email],
      subject: "We've received your enterprise inquiry — Weeber",
      html: buildConfirmHtml(name),
      text: buildConfirmText(name),
      reply_to: "enterprise@weeber.ai",
      tags: [{ name: "category", value: "enterprise" }],
    }),
  }).catch(() => {});
}

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

    const { name, email, businessType, callVolume, painPoint, timeline, extraInfo } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 120) {
      return jsonResponse({ error: { code: "validation_error", message: "Please provide a valid name and email" } }, 400);
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
      return jsonResponse({ error: { code: "validation_error", message: "Please provide a valid name and email" } }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await admin.from("enterprise_inquiries").insert({
      name: name.trim(),
      email: email.trim(),
      business_type: typeof businessType === "string" ? businessType.slice(0, 100) || null : null,
      call_volume: typeof callVolume === "string" ? callVolume.slice(0, 50) || null : null,
      pain_point: typeof painPoint === "string" ? painPoint.slice(0, 200) || null : null,
      timeline: typeof timeline === "string" ? timeline.slice(0, 100) || null : null,
      extra_info: typeof extraInfo === "string" ? extraInfo.slice(0, 2000) || null : null,
    });

    if (error) {
      console.error("Enterprise inquiry insert failed", error);
      return jsonResponse({ error: { code: "internal", message: "Something went wrong" } }, 500);
    }

    console.info("Enterprise inquiry received", email.trim());

    EdgeRuntime.waitUntil(sendConfirmation(email.trim(), name.trim()));

    return jsonResponse({ success: true }, 201);
  } catch (err: any) {
    console.error("enterprise-inquire error", err);
    return jsonResponse({ error: { code: "internal", message: "Something went wrong" } }, 500);
  }
});

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

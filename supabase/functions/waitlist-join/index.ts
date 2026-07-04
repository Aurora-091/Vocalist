import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OFFSET = 43;
const SITE_URL = "https://weeber.ai";
const BACKEND_URL = "https://api.weeber.ai";
const FROM_EMAIL = "Weeber <hello@weeber.ai>";

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildWaitlistWelcomeHtml(name: string, token: string, position: number): string {
  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const greeting = firstName ? `Hi ${escHtml(firstName)},` : "Hi,";
  const posStr = `#${position}`;
  const referralLink = `${SITE_URL}/?ref=${token}`;
  const unsubLink = `${BACKEND_URL}/api/waitlist/unsubscribe?token=${token}`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're in — Weeber</title></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F5F4F0;padding:48px 20px 32px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;">
<tr><td style="padding:0 0 28px;"><img src="https://weeber.ai/weeber_logo_transparent.png" alt="Weeber" width="108" style="display:block;border:0;filter:brightness(0);" /></td></tr>
<tr><td style="background:#FEFEFE;border:1px solid #E8E6E1;border-radius:3px;overflow:hidden;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td style="background:#0B0B0C;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:40px 40px 8px;">
<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#9A9AA0;text-transform:uppercase;letter-spacing:0.9px;">Weeber Waitlist</p>
<h1 style="margin:0 0 28px;font-size:26px;font-weight:800;color:#0B0B0C;line-height:1.15;letter-spacing:-0.4px;">${greeting} You're in — you're ${posStr} in line.</h1>
<p style="margin:0 0 20px;font-size:15px;color:#4A4A4F;line-height:1.75;">Weeber is a voice AI that answers and makes your customer calls — booking appointments, recovering abandoned carts, and following up on every order. Human-sounding, 24/7, no code.</p>
<p style="margin:0 0 8px;font-size:15px;color:#0B0B0C;font-weight:700;">Two things worth knowing:</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;"><tr><td style="width:22px;vertical-align:top;padding-top:3px;"><span style="font-size:15px;color:#0B0B0C;font-weight:600;">→</span></td><td style="font-size:15px;color:#4A4A4F;line-height:1.7;">You're early, so you lock in <strong style="color:#0B0B0C;">founder pricing for life.</strong></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;"><tr><td style="width:22px;vertical-align:top;padding-top:3px;"><span style="font-size:15px;color:#0B0B0C;font-weight:600;">→</span></td><td style="font-size:15px;color:#4A4A4F;line-height:1.7;">You can <strong style="color:#0B0B0C;">skip ahead.</strong> Every business that joins through your link moves you up 2 spots.</td></tr></table>
</td></tr>
<tr><td style="padding:0 40px 32px;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F5F4F0;border:1px solid #E3E1DC;border-radius:2px;"><tr><td style="padding:22px 24px;">
<p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#9A9AA0;text-transform:uppercase;letter-spacing:0.9px;">Your referral link</p>
<p style="margin:0 0 16px;font-size:13px;color:#67676C;word-break:break-all;font-family:'Courier New',Courier,monospace;background:#ECEAE5;padding:10px 12px;border-radius:2px;">${escHtml(referralLink)}</p>
<p style="margin:0;font-size:14px;color:#4A4A4F;line-height:1.6;">Send it to one founder who's losing customers to a phone nobody answers.</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 40px 36px;" align="center"><a href="${escHtml(referralLink)}" style="display:inline-block;background:#0B0B0C;color:#FEFEFE;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:2px;">Share your link →</a></td></tr>
<tr><td style="padding:0 40px 40px;border-top:1px solid #ECEAE5;"><p style="margin:20px 0 0;font-size:14px;color:#67676C;line-height:1.7;">We'll email you the moment your spot opens. Hit reply and tell us what you run.</p><p style="margin:20px 0 0;font-size:14px;color:#0B0B0C;font-weight:600;">— The Weeber team</p></td></tr>
</table></td></tr>
<tr><td style="padding:24px 0 0;text-align:center;">
<p style="margin:0 0 6px;font-size:11px;color:#9A9AA0;">You received this because you joined the waitlist at weeber.ai</p>
<p style="margin:0;font-size:11px;color:#9A9AA0;"><a href="${escHtml(unsubLink)}" style="color:#9A9AA0;text-decoration:underline;">Unsubscribe</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

function buildWaitlistWelcomeText(name: string, token: string, position: number): string {
  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const referralLink = `${SITE_URL}/?ref=${token}`;
  const unsubLink = `${BACKEND_URL}/api/waitlist/unsubscribe?token=${token}`;
  return `${greeting}\n\nYou're on the Weeber waitlist — #${position} in line.\n\nWeeber is a voice AI that answers and makes your customer calls — booking appointments, recovering abandoned carts, and following up on every order. Human-sounding, 24/7, no code.\n\nYour referral link: ${referralLink}\nEvery business that joins through your link moves you up 2 spots.\n\n— The Weeber team\n\nUnsubscribe: ${unsubLink}`;
}

async function sendWelcomeEmail(email: string, name: string, token: string, position: number) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return;

  const nameParts = name ? name.trim().split(/\s+/) : [];
  const audienceId = Deno.env.get("RESEND_AUDIENCE_ID");

  const emailPromise = fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [email],
      subject: "You're in — here's how to move up the line",
      html: buildWaitlistWelcomeHtml(name, token, position),
      text: buildWaitlistWelcomeText(name, token, position),
      reply_to: "hello@weeber.ai",
      tags: [{ name: "category", value: "waitlist" }],
    }),
  });

  const promises: Promise<any>[] = [emailPromise];

  if (audienceId) {
    promises.push(
      fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          first_name: nameParts[0] || undefined,
          last_name: nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined,
          unsubscribed: false,
        }),
      })
    );
  }

  await Promise.allSettled(promises);
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

    const { name, email, phone, source, ref } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0 || name.trim().length > 80) {
      return jsonResponse({ error: { code: "validation_error", message: "Please provide a valid name and email" } }, 400);
    }
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
      return jsonResponse({ error: { code: "validation_error", message: "Please provide a valid name and email" } }, 400);
    }
    if (phone && (typeof phone !== "string" || phone.length < 7 || phone.length > 20)) {
      return jsonResponse({ error: { code: "validation_error", message: "Please provide a valid phone number" } }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let referred_by: string | null = null;
    const refCode = typeof ref === "string" ? ref.slice(0, 20) : null;
    if (refCode) {
      const { data: referrer } = await admin.from("waitlist").select("id").eq("referral_code", refCode).maybeSingle();
      if (referrer) referred_by = referrer.id;
    }

    const row: Record<string, any> = {
      name: name.trim(),
      email: email.trim(),
      source: typeof source === "string" ? source.slice(0, 50) : "website",
    };
    if (phone) row.phone = phone.trim();
    if (referred_by) row.referred_by = referred_by;

    const { data: inserted, error } = await admin
      .from("waitlist")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await admin.from("waitlist").select("referral_code").eq("email", email.trim()).maybeSingle();
        return jsonResponse({ success: true, duplicate: true, referral_code: existing?.referral_code || null });
      }
      console.error("Waitlist insert failed", error);
      return jsonResponse({ error: { code: "internal", message: "Something went wrong" } }, 500);
    }

    const shortCode = "weeber-" + inserted.id.replace(/-/g, "").slice(0, 7);
    await admin.from("waitlist").update({ referral_code: shortCode }).eq("id", inserted.id);

    const { count: position } = await admin
      .from("waitlist")
      .select("*", { count: "exact", head: true })
      .lte("created_at", new Date().toISOString());

    const finalPosition = OFFSET + (position || 1);

    EdgeRuntime.waitUntil(sendWelcomeEmail(email.trim(), name.trim(), inserted.id, finalPosition));

    return jsonResponse({ success: true, referral_code: shortCode });
  } catch (err: any) {
    console.error("waitlist-join error", err);
    return jsonResponse({ error: { code: "internal", message: "Something went wrong" } }, 500);
  }
});

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

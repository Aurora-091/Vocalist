const { Resend } = require("resend");
const env = require("../config/env");
const logger = require("../config/logger");

let resend = null;
if (env.RESEND_API_KEY) {
  resend = new Resend(env.RESEND_API_KEY);
} else {
  if (env.NODE_ENV === "production") {
    throw new Error("FATAL: RESEND_API_KEY is not configured in production environment!");
  } else {
    logger.warn("RESEND_API_KEY is not configured. Email service will run in stub/mock mode (no-op).");
  }
}

const SITE_URL = env.FRONTEND_URL || "https://weeber.ai";
const BACKEND_URL = env.BACKEND_URL || "https://api.weeber.ai";

function buildReferralLink(token) {
  return `${SITE_URL}/?ref=${token}`;
}

function buildUnsubscribeLink(token) {
  return `${BACKEND_URL}/api/waitlist/unsubscribe?token=${token}`;
}

function buildWaitlistWelcomeHtml(name, token, position) {
  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const positionStr = position ? `#${position}` : "on the list";
  const referralLink = buildReferralLink(token);
  const unsubscribeLink = buildUnsubscribeLink(token);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>You're in — Weeber</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F5F4F0;padding:48px 20px 32px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;">

        <!-- Logo -->
        <tr><td style="padding:0 0 28px;">
          <img src="https://weeber.ai/weeber_logo_transparent.png" alt="Weeber" width="108" style="display:block;border:0;filter:brightness(0);" />
        </td></tr>

        <!-- Main card -->
        <tr><td style="background:#FEFEFE;border:1px solid #E8E6E1;border-radius:3px;overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">

            <!-- Top accent line -->
            <tr><td style="background:#0B0B0C;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

            <!-- Content -->
            <tr><td style="padding:40px 40px 8px;">

              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#9A9AA0;text-transform:uppercase;letter-spacing:0.9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                Weeber Waitlist
              </p>
              <h1 style="margin:0 0 28px;font-size:26px;font-weight:800;color:#0B0B0C;line-height:1.15;letter-spacing:-0.4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                ${greeting} You're in —<br>you're ${positionStr} in line.
              </h1>

              <p style="margin:0 0 20px;font-size:15px;color:#4A4A4F;line-height:1.75;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                Quick reminder of what you signed up for: Weeber is a voice AI that answers and makes your customer calls — booking appointments, recovering abandoned carts, and following up on every order. Human-sounding, 24/7, no code.
              </p>

              <p style="margin:0 0 8px;font-size:15px;color:#0B0B0C;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                Two things worth knowing:
              </p>

              <!-- Point 1 -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
                <tr>
                  <td style="width:22px;vertical-align:top;padding-top:3px;">
                    <span style="font-size:15px;color:#0B0B0C;font-weight:600;">→</span>
                  </td>
                  <td style="font-size:15px;color:#4A4A4F;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                    You're early, so you lock in <strong style="color:#0B0B0C;">founder pricing for life.</strong> The first waitlist customers keep it for as long as they stay.
                  </td>
                </tr>
              </table>

              <!-- Point 2 -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td style="width:22px;vertical-align:top;padding-top:3px;">
                    <span style="font-size:15px;color:#0B0B0C;font-weight:600;">→</span>
                  </td>
                  <td style="font-size:15px;color:#4A4A4F;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                    You can <strong style="color:#0B0B0C;">skip ahead.</strong> We open access in small batches, and every business that joins through your link moves you up 2 spots.
                  </td>
                </tr>
              </table>

            </td></tr>

            <!-- Referral box -->
            <tr><td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F5F4F0;border:1px solid #E3E1DC;border-radius:2px;">
                <tr><td style="padding:22px 24px;">
                  <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#9A9AA0;text-transform:uppercase;letter-spacing:0.9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                    Your referral link
                  </p>
                  <p style="margin:0 0 16px;font-size:13px;color:#67676C;word-break:break-all;font-family:'Courier New',Courier,monospace;background:#ECEAE5;padding:10px 12px;border-radius:2px;line-height:1.5;">
                    ${referralLink}
                  </p>
                  <p style="margin:0;font-size:14px;color:#4A4A4F;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                    Send it to one founder who's losing customers to a phone nobody answers — you probably know a few.
                  </p>
                </td></tr>
              </table>
            </td></tr>

            <!-- CTA button -->
            <tr><td style="padding:0 40px 36px;" align="center">
              <a href="${referralLink}" style="display:inline-block;background:#0B0B0C;color:#FEFEFE;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:2px;letter-spacing:-0.1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                Share your link →
              </a>
            </td></tr>

            <!-- Reply CTA -->
            <tr><td style="padding:0 40px 40px;border-top:1px solid #ECEAE5;">
              <p style="margin:20px 0 0;font-size:14px;color:#67676C;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                We'll email you the moment your spot opens. In the meantime, hit reply and tell us what you run — it helps us get you into the right batch first.
              </p>
              <p style="margin:20px 0 0;font-size:14px;color:#0B0B0C;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                — The Weeber team
              </p>
            </td></tr>

          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0 0;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;color:#9A9AA0;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            You received this because you joined the waitlist at weeber.ai
          </p>
          <p style="margin:0;font-size:11px;color:#9A9AA0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <a href="${unsubscribeLink}" style="color:#9A9AA0;text-decoration:underline;">Unsubscribe from future emails</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildWaitlistWelcomeText(name, token, position) {
  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const positionStr = position ? `#${position}` : "on the list";
  const referralLink = buildReferralLink(token);
  const unsubscribeLink = buildUnsubscribeLink(token);

  return `Subject: You're in — here's how to move up the line

${greeting}

You're on the Weeber waitlist. Right now you're ${positionStr} in line.

Quick reminder of what you signed up for: Weeber is a voice AI that answers and makes your customer calls — booking appointments, recovering abandoned carts, and following up on every order. Human-sounding, 24/7, no code.

Two things worth knowing:

→ You're early, so you lock in founder pricing for life. The first waitlist customers keep it for as long as they stay.

→ You can skip ahead. We open access in small batches, and every business that joins through your link moves you up 2 spots:

${referralLink}

Send it to one founder who's losing customers to a phone nobody answers — you probably know a few.

We'll email you the moment your spot opens. In the meantime, hit reply and tell us what you run — it helps us get you into the right batch first.

— The Weeber team

---
To unsubscribe from future emails: ${unsubscribeLink}`;
}

async function sendWaitlistWelcome(email, name, token, position) {
  if (!resend) {
    logger.warn("RESEND_API_KEY not configured — skipping waitlist welcome email");
    return;
  }

  const subject = "You're in — here's how to move up the line";

  const tasks = [
    resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: [email],
      subject,
      html: buildWaitlistWelcomeHtml(name, token, position),
      text: buildWaitlistWelcomeText(name, token, position),
      replyTo: "hello@weeber.ai",
      tags: [{ name: "category", value: "waitlist" }],
    }),
  ];

  if (env.RESEND_AUDIENCE_ID) {
    const nameParts = name ? name.trim().split(/\s+/) : [];
    tasks.push(
      resend.contacts.create({
        audienceId: env.RESEND_AUDIENCE_ID,
        email,
        firstName: nameParts[0] || undefined,
        lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined,
        unsubscribed: false,
      })
    );
  } else {
    logger.warn("RESEND_AUDIENCE_ID not set — contact not added to Resend audience");
  }

  const [emailResult, audienceResult] = await Promise.allSettled(tasks);

  if (emailResult.status === "fulfilled") {
    const { data, error } = emailResult.value;
    if (error) {
      logger.error({ err: error, to: email }, "Resend email send failed");
    } else {
      logger.info({ emailId: data?.id, to: email }, "Waitlist welcome email sent");
    }
  } else {
    logger.error({ err: emailResult.reason, to: email }, "Resend email send threw");
  }

  if (audienceResult && audienceResult.status === "fulfilled") {
    const { error } = audienceResult.value;
    if (error) {
      logger.error({ err: error, to: email }, "Resend audience add failed");
    } else {
      logger.info({ to: email }, "Contact added to Resend audience");
    }
  } else if (audienceResult && audienceResult.status === "rejected") {
    logger.error({ err: audienceResult.reason, to: email }, "Resend audience add threw");
  }
}

// ─── Broadcast Templates ─────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildBroadcastShell(name, recipientId, { heading, bodyHtml, ctaText, ctaUrl, footerNote }) {
  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const unsubscribeLink = recipientId ? buildUnsubscribeLink(recipientId) : "#";

  const ctaBlock = ctaText && ctaUrl ? `
            <tr><td style="padding:0 40px 36px;" align="center">
              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#0B0B0C;color:#FEFEFE;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:2px;letter-spacing:-0.1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                ${escapeHtml(ctaText)} →
              </a>
            </td></tr>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F5F4F0;padding:48px 20px 32px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;">

        <tr><td style="padding:0 0 28px;">
          <img src="https://weeber.ai/weeber_logo_transparent.png" alt="Weeber" width="108" style="display:block;border:0;filter:brightness(0);" />
        </td></tr>

        <tr><td style="background:#FEFEFE;border:1px solid #E8E6E1;border-radius:3px;overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">

            <tr><td style="background:#0B0B0C;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

            <tr><td style="padding:40px 40px 8px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#9A9AA0;text-transform:uppercase;letter-spacing:0.9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                ${escapeHtml(footerNote || "Weeber Update")}
              </p>
              <h1 style="margin:0 0 28px;font-size:26px;font-weight:800;color:#0B0B0C;line-height:1.15;letter-spacing:-0.4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                ${greeting} ${escapeHtml(heading)}
              </h1>
              ${bodyHtml}
            </td></tr>

            ${ctaBlock}

            <tr><td style="padding:0 40px 40px;border-top:1px solid #ECEAE5;">
              <p style="margin:20px 0 0;font-size:14px;color:#0B0B0C;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                — The Weeber team
              </p>
            </td></tr>

          </table>
        </td></tr>

        <tr><td style="padding:24px 0 0;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;color:#9A9AA0;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            You received this because you're subscribed to updates from weeber.ai
          </p>
          <p style="margin:0;font-size:11px;color:#9A9AA0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <a href="${unsubscribeLink}" style="color:#9A9AA0;text-decoration:underline;">Unsubscribe from future emails</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildBroadcastHtml(name, recipientId, template, variables) {
  const v = variables || {};
  const heading = v.heading || "Update from Weeber";

  if (template === "product_update") {
    const bodyHtml = `
              <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#0B0B0C;text-transform:uppercase;letter-spacing:0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                ${escapeHtml(v.feature_name || "")}
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#4A4A4F;line-height:1.75;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                ${escapeHtml(v.body_text || "")}
              </p>`;
    return buildBroadcastShell(name, recipientId, {
      heading,
      bodyHtml,
      ctaText: v.cta_text,
      ctaUrl: v.cta_url,
      footerNote: "Product Update",
    });
  }

  // waitlist_update and custom share the same layout
  const footerNote = template === "waitlist_update" ? "Waitlist Update" : "Weeber Update";
  const bodyHtml = `
              <p style="margin:0 0 20px;font-size:15px;color:#4A4A4F;line-height:1.75;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                ${escapeHtml(v.body_text || "")}
              </p>`;
  return buildBroadcastShell(name, recipientId, {
    heading,
    bodyHtml,
    ctaText: v.cta_text,
    ctaUrl: v.cta_url,
    footerNote,
  });
}

async function sendBroadcastEmail(email, name, template, subject, variables, recipientId) {
  if (!resend) {
    logger.warn("RESEND_API_KEY not configured — skipping broadcast email");
    return { success: false };
  }

  const html = buildBroadcastHtml(name, recipientId, template, variables);

  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: [email],
    subject,
    html,
    replyTo: "hello@weeber.ai",
    tags: [{ name: "category", value: "broadcast" }, { name: "template", value: template }],
  });

  if (error) {
    logger.error({ err: error, to: email, template }, "Broadcast email send failed");
    return { success: false };
  }
  return { success: true, emailId: data?.id };
}

async function resolveRecipients(recipientType) {
  const { requireAdmin } = require("../config/supabase");
  const admin = requireAdmin();

  if (recipientType === "waitlist_pending") {
    const { data } = await admin.from("waitlist").select("id, email, name").eq("status", "pending").eq("unsubscribed", false);
    return (data || []).map((r) => ({ id: r.id, email: r.email, name: r.name || null }));
  }
  if (recipientType === "waitlist_approved") {
    const { data } = await admin.from("waitlist").select("id, email, name").eq("status", "approved").eq("unsubscribed", false);
    return (data || []).map((r) => ({ id: r.id, email: r.email, name: r.name || null }));
  }
  if (recipientType === "waitlist_all") {
    const { data } = await admin.from("waitlist").select("id, email, name").eq("unsubscribed", false);
    return (data || []).map((r) => ({ id: r.id, email: r.email, name: r.name || null }));
  }
  if (recipientType === "users_all") {
    const { data } = await admin.from("users").select("id, email, display_name");
    return (data || []).map((r) => ({ id: r.id, email: r.email, name: r.display_name || null }));
  }

  return [];
}

module.exports = { sendWaitlistWelcome, sendBroadcastEmail, resolveRecipients, buildBroadcastHtml, sendEnterpriseConfirmation };

function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEnterpriseConfirmationHtml(name) {
  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const safeFirstName = firstName ? escapeHtml(firstName) : null;
  const greeting = safeFirstName ? `Hi ${safeFirstName},` : "Hi,";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>We received your inquiry — Weeber</title>
</head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F5F4F0;padding:48px 20px 32px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;">

        <!-- Logo -->
        <tr><td style="padding:0 0 28px;">
          <img src="https://weeber.ai/weeber_logo_transparent.png" alt="Weeber" width="108" style="display:block;border:0;filter:brightness(0);" />
        </td></tr>

        <!-- Main card -->
        <tr><td style="background:#FEFEFE;border:1px solid #E8E6E1;border-radius:3px;overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">

            <!-- Top accent line -->
            <tr><td style="background:#0B0B0C;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

            <!-- Content -->
            <tr><td style="padding:40px 40px 36px;">

              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#9A9AA0;text-transform:uppercase;letter-spacing:0.9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                Enterprise
              </p>
              <h1 style="margin:0 0 24px;font-size:26px;font-weight:800;color:#0B0B0C;line-height:1.15;letter-spacing:-0.4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                ${greeting} We've got your inquiry.
              </h1>

              <p style="margin:0 0 20px;font-size:15px;color:#4A4A4F;line-height:1.75;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                Thanks for reaching out. Our enterprise team reviews every inquiry personally and typically responds within one business day.
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:#4A4A4F;line-height:1.75;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                We'll be in touch shortly to understand your setup in more detail and walk you through what Weeber can do for high-volume or regulated environments.
              </p>

              <p style="margin:0 0 8px;font-size:15px;color:#4A4A4F;line-height:1.75;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                In the meantime, if you have an urgent question you can reach us directly at <a href="mailto:enterprise@weeber.ai" style="color:#0B0B0C;font-weight:600;text-decoration:none;">enterprise@weeber.ai</a>.
              </p>

            </td></tr>

            <!-- Sign-off -->
            <tr><td style="padding:0 40px 40px;border-top:1px solid #ECEAE5;">
              <p style="margin:20px 0 0;font-size:14px;color:#67676C;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                Looking forward to speaking soon.
              </p>
              <p style="margin:8px 0 0;font-size:14px;color:#0B0B0C;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                — The Weeber team
              </p>
            </td></tr>

          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0 0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9A9AA0;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            You received this because you submitted an enterprise inquiry at weeber.ai
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendEnterpriseConfirmation(email, name) {
  if (!resend) {
    logger.warn("RESEND_API_KEY not configured — skipping enterprise confirmation email");
    return;
  }

  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: [email],
    subject: "We've received your enterprise inquiry — Weeber",
    html: buildEnterpriseConfirmationHtml(name),
    text: buildEnterpriseConfirmationText(name),
    replyTo: "enterprise@weeber.ai",
    tags: [{ name: "category", value: "enterprise" }],
  });

  if (error) {
    logger.error({ err: error, to: email }, "Enterprise confirmation email failed");
  } else {
    logger.info({ emailId: data?.id, to: email }, "Enterprise confirmation email sent");
  }
}

function buildEnterpriseConfirmationText(name) {
  const firstName = name ? name.trim().split(/\s+/)[0] : null;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  return `${greeting}

We've received your enterprise inquiry and our team will be in touch within one business day.

In the meantime you can reach us directly at enterprise@weeber.ai.

Looking forward to speaking soon.

— The Weeber team`;
}

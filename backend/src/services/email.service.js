const { Resend } = require("resend");
const env = require("../config/env");
const logger = require("../config/logger");

let resend = null;
if (env.RESEND_API_KEY) {
  resend = new Resend(env.RESEND_API_KEY);
}

function buildWaitlistWelcomeHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fb;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;">
        <!-- Header -->
        <tr><td style="padding:32px 32px 24px;border-bottom:1px solid #f1f5f9;">
          <span style="font-size:18px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;">Weeber</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#0f172a;line-height:1.3;">
            You're on the list.
          </h1>
          <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
            Thanks for signing up for early access to Weeber — the compliance-first voice agent for small businesses.
          </p>
          <h2 style="margin:0 0 12px;font-size:15px;font-weight:600;color:#0f172a;">What happens next:</h2>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="padding:4px 10px 4px 0;font-size:14px;color:#64748b;vertical-align:top;">1.</td>
                <td style="padding:4px 0;font-size:14px;color:#475569;line-height:1.5;">We're onboarding in small batches to ensure quality.</td></tr>
            <tr><td style="padding:4px 10px 4px 0;font-size:14px;color:#64748b;vertical-align:top;">2.</td>
                <td style="padding:4px 0;font-size:14px;color:#475569;line-height:1.5;">You'll receive an invite when your batch opens.</td></tr>
            <tr><td style="padding:4px 10px 4px 0;font-size:14px;color:#64748b;vertical-align:top;">3.</td>
                <td style="padding:4px 0;font-size:14px;color:#475569;line-height:1.5;">First 100 businesses get founder pricing — locked in forever.</td></tr>
          </table>
          <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
            In the meantime, if you have questions or want to tell us about your use case, just reply to this email.
          </p>
          <p style="margin:0;font-size:14px;color:#0f172a;font-weight:500;">
            — The Weeber Team
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #f1f5f9;background:#f8f9fb;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
            You received this because you signed up at weeber.ai. No further emails until your invite is ready.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendWaitlistWelcome(email) {
  if (!resend) {
    logger.warn("RESEND_API_KEY not configured — skipping waitlist welcome email");
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: [email],
      subject: "You're on the list — Weeber",
      html: buildWaitlistWelcomeHtml(),
      text: `You're on the list.\n\nThanks for signing up for early access to Weeber — the compliance-first voice agent for small businesses.\n\nWhat happens next:\n1. We're onboarding in small batches to ensure quality.\n2. You'll receive an invite when your batch opens.\n3. First 100 businesses get founder pricing — locked in forever.\n\nIf you have questions, just reply to this email.\n\n— The Weeber Team`,
      tags: [{ name: "category", value: "waitlist" }],
    });

    if (error) {
      logger.error({ err: error, to: email }, "Resend email send failed");
    } else {
      logger.info({ emailId: data?.id, to: email }, "Waitlist welcome email sent");
    }
  } catch (err) {
    logger.error({ err, to: email }, "Resend email send threw");
  }
}

module.exports = { sendWaitlistWelcome };

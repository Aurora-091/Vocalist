const { Resend } = require("resend");
const env = require("../config/env");
const logger = require("../config/logger");

let resend = null;
if (env.RESEND_API_KEY) {
  resend = new Resend(env.RESEND_API_KEY);
}

function buildWaitlistWelcomeHtml(name) {
  const greeting = name ? `Hi ${name}, you're in.` : "You're in.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Welcome to Weeber</title>
</head>
<body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0F172A;padding:48px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;">

        <!-- Logo -->
        <tr><td style="padding:0 0 32px;">
          <img src="https://weeber.ai/weeber_logo_transparent.png" alt="Weeber" width="120" style="display:block;border:0;" />
        </td></tr>

        <!-- Main card -->
        <tr><td style="background:#FFFFFF;border-radius:2px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">

            <!-- Green confirmation bar -->
            <tr><td style="background:#22C55E;height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

            <!-- Content -->
            <tr><td style="padding:40px 36px 36px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0F172A;line-height:1.2;letter-spacing:-0.3px;">
                ${greeting}
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
                Thanks for joining the Weeber early access waitlist. We're building the compliance-first voice agent for small businesses — and you'll be among the first to use it.
              </p>

              <!-- What to expect box -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F8F9FB;border:1px solid #E2E8F0;margin:0 0 28px;">
                <tr><td style="padding:24px 28px;">
                  <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#0F172A;text-transform:uppercase;letter-spacing:0.8px;">
                    What to expect
                  </p>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="padding:6px 14px 6px 0;font-size:14px;color:#22C55E;vertical-align:top;font-weight:700;">&#10003;</td>
                      <td style="padding:6px 0;font-size:14px;color:#475569;line-height:1.6;">We onboard in small batches to guarantee quality.</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 14px 6px 0;font-size:14px;color:#22C55E;vertical-align:top;font-weight:700;">&#10003;</td>
                      <td style="padding:6px 0;font-size:14px;color:#475569;line-height:1.6;">You'll get an invite email the moment your batch opens.</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 14px 6px 0;font-size:14px;color:#22C55E;vertical-align:top;font-weight:700;">&#10003;</td>
                      <td style="padding:6px 0;font-size:14px;color:#475569;line-height:1.6;">First 100 businesses lock in founder pricing — forever.</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <p style="margin:0 0 6px;font-size:14px;color:#64748B;line-height:1.6;">
                Have questions or want to share your use case? Just reply to this email — it goes straight to our team.
              </p>
            </td></tr>

            <!-- Sign-off -->
            <tr><td style="padding:0 36px 36px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-right:12px;vertical-align:middle;">
                    <div style="width:36px;height:36px;border-radius:50%;background:#0F172A;text-align:center;line-height:36px;color:#FFFFFF;font-size:14px;font-weight:600;">W</div>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-size:14px;font-weight:600;color:#0F172A;">The Weeber Team</p>
                    <p style="margin:2px 0 0;font-size:12px;color:#94A3B8;">hello@weeber.ai</p>
                  </td>
                </tr>
              </table>
            </td></tr>

          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:28px 0 0;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:#64748B;line-height:1.5;">
            You received this because you signed up at weeber.ai
          </p>
          <p style="margin:0;font-size:11px;color:#475569;line-height:1.5;">
            No further emails until your invite is ready. No spam, ever.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendWaitlistWelcome(email, name) {
  if (!resend) {
    logger.warn("RESEND_API_KEY not configured — skipping waitlist welcome email");
    return;
  }

  const greeting = name ? `Hi ${name}, you're in.` : "You're in.";
  const subject = name ? `You're in, ${name} — Weeber Early Access` : "You're in — Weeber Early Access";

  const tasks = [
    resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: [email],
      subject,
      html: buildWaitlistWelcomeHtml(name),
      replyTo: "hello@weeber.ai",
      text: `${greeting}\n\nThanks for joining the Weeber early access waitlist. We're building the compliance-first voice agent for small businesses — and you'll be among the first to use it.\n\nWhat to expect:\n- We onboard in small batches to guarantee quality.\n- You'll get an invite email the moment your batch opens.\n- First 100 businesses lock in founder pricing — forever.\n\nHave questions or want to share your use case? Just reply to this email — it goes straight to our team.\n\n— The Weeber Team\nhello@weeber.ai`,
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

module.exports = { sendWaitlistWelcome };

const crypto = require("crypto");
const { requireAdmin } = require("../config/supabase");
const logger = require("../config/logger");

const POLL_MS = 60_000;

async function dispatchOnce() {
  const supabase = requireAdmin();

  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: calls, error: callsErr } = await supabase
    .from("calls")
    .select("id, org_id, status, outcome, ended_at, agent_id, contact_id, duration_sec")
    .in("status", ["completed", "failed", "voicemail"])
    .gte("created_at", since)
    .limit(200);

  if (callsErr || !calls?.length) return 0;

  const orgIds = [...new Set(calls.map((c) => c.org_id))];
  const { data: endpoints } = await supabase
    .from("webhook_endpoints")
    .select("id, org_id, url, events, secret_ref, status")
    .in("org_id", orgIds)
    .eq("status", "active");

  if (!endpoints?.length) return 0;

  let dispatched = 0;
  for (const call of calls) {
    const event =
      call.status === "completed"
        ? "call.completed"
        : call.status === "voicemail"
        ? "call.voicemail"
        : "call.failed";

    const targets = endpoints.filter(
      (e) => e.org_id === call.org_id && (e.events || []).includes(event)
    );
    if (!targets.length) continue;

    const body = JSON.stringify({ event, call });
    for (const ep of targets) {
      const sig = ep.secret_ref
        ? crypto.createHmac("sha256", ep.secret_ref).update(body).digest("hex")
        : null;
      try {
        await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Aurora-Event": event,
            ...(sig ? { "X-Aurora-Signature": sig } : {}),
          },
          body,
          signal: AbortSignal.timeout(5_000),
        });
        dispatched += 1;
      } catch (err) {
        logger.warn({ err, ep: ep.id }, "webhook dispatch failed");
      }
    }
  }
  return dispatched;
}

function start() {
  let timer;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const n = await dispatchOnce();
      if (n) logger.info({ dispatched: n }, "webhooks-out dispatch");
    } catch (err) {
      logger.error({ err }, "webhooks-out worker error");
    } finally {
      running = false;
    }
  };

  timer = setInterval(tick, POLL_MS);
  tick();
  return () => clearInterval(timer);
}

module.exports = { start, dispatchOnce };

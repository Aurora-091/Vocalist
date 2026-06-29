const WebSocket = require("ws");
const logger = require("../config/logger");
const { requireAdmin } = require("../config/supabase");
const personaService = require("./persona.service");
const CustomVoiceOrchestrator = require("../providers/voice/custom.orchestrator");
const { recordVoiceMinutes } = require("../modules/billing/metering");

// Handles the upgrade stream connection from server.js
async function handleTwilioStream(ws, req) {
  // Extract call ID from URL: /v1/twilio/stream/:callId
  const urlParts = req.url.split("/");
  const callId = urlParts[urlParts.length - 1];

  logger.info({ callId }, "Twilio Media Stream WebSocket connected");

  const admin = requireAdmin();
  const startTime = Date.now();
  let streamSid = null;
  let callRow = null;
  let orchestrator = null;
  let isClosed = false;

  // Heartbeat ping-pong to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 15000);

  const setupPromise = (async () => {
    // 1. Fetch Call & Agent metadata
    const { data, error } = await admin
      .from("calls")
      .select("*, agents(*)")
      .eq("id", callId)
      .maybeSingle();

    if (error || !data) {
      throw new Error(`Call not found: ${callId}`);
    }
    callRow = data;

    const elApiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = callRow.agents?.voice_id;
    const agentPersona = callRow.agents?.persona || {};
    const systemPrompt = personaService.generateSystemPrompt(agentPersona);

    logger.info({ callId, voiceId }, "Initializing CustomVoiceOrchestrator connection");

    try {
      orchestrator = new CustomVoiceOrchestrator({
        voiceId,
        apiKey: elApiKey,
        systemPrompt,
        onAudio: (base64Audio) => {
          if (isClosed || ws.readyState !== WebSocket.OPEN || !streamSid) return;
          try {
            ws.send(JSON.stringify({
              event: "media",
              streamSid,
              media: {
                payload: base64Audio
              }
            }));
          } catch (err) {
            logger.error({ err: err.message }, "Error piping audio back to Twilio");
          }
        }
      });

      orchestrator.on("close", () => {
        logger.info({ callId }, "CustomVoiceOrchestrator closed");
        cleanup();
      });

    } catch (err) {
      logger.error({ err: err.message, callId }, "Orchestrator initialization FAILED");
      throw new Error(`Voice engine initialization failed: ${err.message}`);
    }

    return { useRealElevenLabs: true };
  })();

  setupPromise.catch((err) => {
    logger.error({ err: err.message, callId }, "Failed to setup Twilio media stream");
    cleanup();
  });

  // 3. Handle messages from Twilio
  ws.on("message", async (message) => {
    if (isClosed) return;
    try {
      const data = JSON.parse(message.toString());
      logger.info({ event: data.event, callId }, "Received event from Twilio");

      // Await setup to ensure callRow and orchestrator are populated before handling message
      const setup = await setupPromise;
      if (!setup || isClosed) return;

      switch (data.event) {
        case "start":
          streamSid = data.start.streamSid;
          logger.info({ streamSid, callId }, "Twilio stream started");

          // Update call record status to in_progress
          const { error: upErr1 } = await admin
            .from("calls")
            .update({ status: "in_progress" })
            .eq("id", callId);
          if (upErr1) {
            logger.error({ err: upErr1.message, callId }, "Failed to update call status to in_progress");
          }

          const { error: evErr1 } = await admin.from("call_events").insert({
            org_id: callRow.org_id,
            call_id: callId,
            kind: "twilio.in_progress",
            payload: data
          });
          if (evErr1) {
            logger.error({ err: evErr1.message, callId }, "Failed to insert call event twilio.in_progress");
          }
          break;

        case "media":
          if (orchestrator) {
            orchestrator.handleTwilioAudio(data.media.payload);
          }
          break;

        case "stop":
          logger.info({ streamSid, callId }, "Twilio stream stopped");
          cleanup();
          break;
      }
    } catch (err) {
      logger.error({ err: err.message }, "Error parsing Twilio media stream message");
    }
  });

  ws.on("error", (err) => {
    logger.error({ err: err.message, callId }, "Twilio stream WebSocket error");
    cleanup();
  });

  ws.on("close", () => {
    logger.info({ callId }, "Twilio stream WebSocket closed");
    cleanup();
  });

  // Helper to cleanup sockets and update DB
  async function cleanup() {
    if (isClosed) return;
    isClosed = true;
    clearInterval(pingInterval);

    try {
      ws.close();
    } catch {}

    if (orchestrator) {
      try {
        orchestrator.close();
      } catch {}
    }

    if (callRow) {
      const duration = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      const formattedText = (orchestrator?.transcriptHistory || [])
        .map((entry) => `${entry.role === "user" ? "User" : "Assistant"}: ${entry.content}`)
        .join("\n");

      // Update Call state to completed with duration and transcript
      const { error: upErr2 } = await admin
        .from("calls")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          duration_sec: duration,
          transcript: formattedText
        })
        .eq("id", callId);
      if (upErr2) {
        logger.error({ err: upErr2.message, callId }, "Failed to update call status to completed");
      }

      const { error: evErr2 } = await admin.from("call_events").insert({
        org_id: callRow.org_id,
        call_id: callId,
        kind: "twilio.completed",
        payload: { duration_sec: duration }
      });
      if (evErr2) {
        logger.error({ err: evErr2.message, callId }, "Failed to insert call event twilio.completed");
      }

      // Record voice minutes to usage ledger
      try {
        await recordVoiceMinutes(admin, {
          orgId: callRow.org_id,
          callId: callId,
          durationSec: duration,
          providerCallId: callRow.provider_call_id || callId
        });
      } catch (ledgerErr) {
        logger.error({ err: ledgerErr.message, callId }, "Failed to record usage ledger transaction");
      }
    }
  }
}

module.exports = { handleTwilioStream };


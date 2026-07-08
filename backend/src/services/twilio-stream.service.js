const WebSocket = require("ws");
const logger = require("../config/logger");
const { requireAdmin } = require("../config/supabase");
const metrics = require("../utils/metrics");

const TERMINAL_STATUSES = ["completed", "failed", "no_answer"];
const EL_CONNECT_TIMEOUT_MS = 10_000;
const EL_PING_INTERVAL_MS = 20_000;
const MAX_BUFFERED_BYTES = 64 * 1024;

async function connectElevenLabsWs(agentRef, apiKey, callId) {
  const socket = new WebSocket(
    `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentRef}`,
    { headers: { "xi-api-key": apiKey } }
  );

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error("ElevenLabs WebSocket connection timed out"));
    }, EL_CONNECT_TIMEOUT_MS);

    socket.on("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  logger.info({ callId, agentRef }, "ElevenLabs WebSocket connected");
  return socket;
}

async function handleTwilioStream(ws, req) {
  const urlParts = req.url.split("/");
  const callId = urlParts[urlParts.length - 1];

  logger.info({ callId }, "Twilio Media Stream WebSocket connected");

  const admin = requireAdmin();
  let streamSid = null;
  let callRow = null;
  let elevenLabsSocket = null;
  let isClosed = false;

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }, 15000);

  let elPingInterval = null;

  const setupPromise = (async () => {
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
    const agentRef = callRow.agents?.provider_ref;
    const useRealElevenLabs = elApiKey && agentRef && process.env.VOICE_PROVIDER_FORCE_MOCK !== "1";

    if (useRealElevenLabs) {
      // Connect with one retry on transient failure
      try {
        elevenLabsSocket = await connectElevenLabsWs(agentRef, elApiKey, callId);
      } catch (firstErr) {
        logger.warn({ err: firstErr.message, callId, agentRef }, "ElevenLabs WS first attempt failed — retrying in 1s");
        await new Promise((r) => setTimeout(r, 1000));
        try {
          elevenLabsSocket = await connectElevenLabsWs(agentRef, elApiKey, callId);
        } catch (retryErr) {
          logger.error({ err: retryErr.message, callId, agentRef }, "ElevenLabs WS retry FAILED — call cannot proceed");
          metrics.increment("elevenlabs.stream_connect_failed", 1, { retry: "true" });

          await admin.from("webhook_dlq").insert({
            org_id: callRow.org_id,
            source: "elevenlabs_stream",
            event_type: "connection_failed",
            payload: { call_id: callId, agent_ref: agentRef, error: retryErr.message },
            error_message: retryErr.message,
            next_retry_at: null,
          }).catch(() => {});

          throw new Error(`Voice provider unavailable: ${retryErr.message}`);
        }
      }

      metrics.increment("elevenlabs.stream_connected", 1);

      // Periodic ping to detect silent ElevenLabs disconnects
      elPingInterval = setInterval(() => {
        if (elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
          elevenLabsSocket.ping();
        }
      }, EL_PING_INTERVAL_MS);

      elevenLabsSocket.on("message", (data) => {
        if (isClosed || ws.readyState !== WebSocket.OPEN) return;
        try {
          const msg = JSON.parse(data.toString());
          if (msg.event === "audio" && msg.audio?.chunk && streamSid) {
            if (ws.bufferedAmount < MAX_BUFFERED_BYTES) {
              ws.send(JSON.stringify({
                event: "media",
                streamSid,
                media: { payload: msg.audio.chunk }
              }));
            }
          } else if (msg.event !== "audio") {
            logger.debug({ callId, event: msg.event }, "ElevenLabs non-audio event");
          }
        } catch (err) {
          logger.error({ err: err.message, callId }, "Error processing ElevenLabs message");
        }
      });

      elevenLabsSocket.on("error", (err) => {
        logger.error({ err: err.message, callId }, "ElevenLabs WebSocket error");
      });

      elevenLabsSocket.on("close", (code, reason) => {
        logger.info({ callId, code, reason: reason ? reason.toString() : "" }, "ElevenLabs WebSocket closed");
        cleanup();
      });
    } else {
      logger.info({ callId }, "Running in Mock/Echo streaming mode");
    }
    return { useRealElevenLabs };
  })();

  setupPromise.catch((err) => {
    logger.error({ err: err.message, callId }, "Failed to setup Twilio media stream");
    cleanup();
  });

  ws.on("message", async (message) => {
    if (isClosed) return;
    try {
      const data = JSON.parse(message.toString());

      const setup = await setupPromise;
      if (!setup || isClosed) return;

      switch (data.event) {
        case "start":
          streamSid = data.start.streamSid;
          logger.info({ streamSid, callId }, "Twilio stream started");

          const { error: upErr1 } = await admin
            .from("calls")
            .update({ status: "in_progress" })
            .eq("id", callId);
          if (upErr1) {
            logger.error({ err: upErr1.message, callId }, "Failed to update call status to in_progress");
          }

          await admin.from("call_events").insert({
            org_id: callRow.org_id,
            call_id: callId,
            kind: "twilio.in_progress",
            payload: data
          }).catch((e) => logger.warn({ err: e.message, callId }, "Failed to insert call_event"));

          if (!setup.useRealElevenLabs) {
            sendMockAudio(ws, streamSid);
          }
          break;

        case "media":
          if (setup.useRealElevenLabs && elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
            if (elevenLabsSocket.bufferedAmount < MAX_BUFFERED_BYTES) {
              elevenLabsSocket.send(JSON.stringify({
                event: "user_audio_chunk",
                user_audio_chunk: data.media.payload
              }));
            }
          }
          break;

        case "stop":
          logger.info({ streamSid, callId }, "Twilio stream stopped");
          cleanup();
          break;
      }
    } catch (err) {
      logger.error({ err: err.message, callId }, "Error parsing Twilio media stream message");
    }
  });

  ws.on("error", (err) => {
    logger.error({ err: err.message, callId }, "Twilio stream WebSocket error");
    cleanup();
  });

  ws.on("close", (code, reason) => {
    logger.info({ callId, code, reason: reason ? reason.toString() : "" }, "Twilio stream WebSocket closed");
    cleanup();
  });

  async function cleanup() {
    if (isClosed) return;
    isClosed = true;
    clearInterval(pingInterval);
    if (elPingInterval) clearInterval(elPingInterval);

    try { ws.close(); } catch {}

    if (elevenLabsSocket) {
      try { elevenLabsSocket.close(); } catch {}
    }

    if (callRow) {
      // Only update if call is not already in a terminal state (webhook may have arrived first)
      const { data: currentCall } = await admin
        .from("calls")
        .select("status")
        .eq("id", callId)
        .maybeSingle();

      if (currentCall && TERMINAL_STATUSES.includes(currentCall.status)) {
        logger.debug({ callId, status: currentCall.status }, "Call already terminal — skipping stream cleanup update");
        return;
      }

      const endTime = new Date();
      const startTime = callRow.started_at ? new Date(callRow.started_at) : endTime;
      const duration = Math.max(0, Math.floor((endTime - startTime) / 1000));

      const { error: upErr2 } = await admin
        .from("calls")
        .update({
          status: "completed",
          ended_at: endTime.toISOString(),
          duration_sec: duration
        })
        .eq("id", callId);
      if (upErr2) {
        logger.error({ err: upErr2.message, callId }, "Failed to update call status to completed");
      }

      await admin.from("call_events").insert({
        org_id: callRow.org_id,
        call_id: callId,
        kind: "twilio.completed",
        payload: { duration_sec: duration }
      }).catch((e) => logger.warn({ err: e.message, callId }, "Failed to insert call_event"));
    }
  }
}

function sendMockAudio(ws, streamSid) {
  const silence = Buffer.alloc(800, 0xFF).toString("base64");
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      event: "media",
      streamSid,
      media: { payload: silence }
    }));
  }
}

module.exports = { handleTwilioStream };

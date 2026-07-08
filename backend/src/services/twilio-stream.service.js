const WebSocket = require("ws");
const logger = require("../config/logger");
const { requireAdmin } = require("../config/supabase");

// Handles the upgrade stream connection from server.js
async function handleTwilioStream(ws, req) {
  // Extract call ID from URL: /v1/twilio/stream/:callId
  const urlParts = req.url.split("/");
  const callId = urlParts[urlParts.length - 1];

  logger.info({ callId }, "Twilio Media Stream WebSocket connected");

  const admin = requireAdmin();
  let streamSid = null;
  let callRow = null;
  let elevenLabsSocket = null;
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

    // 2. Decide if we connect to ElevenLabs or use Mock Mode
    const elApiKey = process.env.ELEVENLABS_API_KEY;
    const agentRef = callRow.agents?.provider_ref;
    const useRealElevenLabs = elApiKey && agentRef && process.env.VOICE_PROVIDER_FORCE_MOCK !== "1";

    if (useRealElevenLabs) {
      logger.info({ agentRef }, "Initializing ElevenLabs Conversational AI WebSocket connection");

      try {
        elevenLabsSocket = new WebSocket(
          `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentRef}`,
          {
            headers: {
              "xi-api-key": elApiKey
            }
          }
        );

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("ElevenLabs WebSocket connection timed out after 10s"));
          }, 10000);

          elevenLabsSocket.on("open", () => {
            clearTimeout(timeout);
            logger.info({ callId }, "ElevenLabs WebSocket connection opened");
            resolve();
          });
          elevenLabsSocket.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      } catch (err) {
        logger.error({ err: err.message, callId, agentRef }, "ElevenLabs WebSocket connection FAILED - call cannot proceed");
        elevenLabsSocket = null;

        // Write to dead letter queue for investigation
        await admin.from("webhook_dlq").insert({
          org_id: callRow.org_id,
          source: "elevenlabs_stream",
          event_type: "connection_failed",
          payload: { call_id: callId, agent_ref: agentRef, error: err.message },
          error_message: err.message,
          next_retry_at: null,
        }).catch(() => {});

        throw new Error(`Voice provider unavailable: ${err.message}`);
      }

      elevenLabsSocket.on("message", (data) => {
        if (isClosed || ws.readyState !== WebSocket.OPEN) return;
        try {
          const msg = JSON.parse(data.toString());
          logger.info({ callId, event: msg.event }, "Received event from ElevenLabs");
          // If ElevenLabs returns audio, send it back to Twilio
          if (msg.event === "audio" && msg.audio?.chunk && streamSid) {
            logger.info({ callId, payloadLength: msg.audio.chunk.length }, "Forwarding ElevenLabs audio chunk to Twilio");
            ws.send(JSON.stringify({
              event: "media",
              streamSid,
              media: {
                payload: msg.audio.chunk
              }
            }));
          }
        } catch (err) {
          logger.error({ err: err.message }, "Error processing ElevenLabs message");
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
      logger.info({ callId }, "Running in Mock/Echo streaming mode (no real voice provider connected)");
    }
    return { useRealElevenLabs };
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

      // Await setup to ensure callRow and elevenLabsSocket are populated before handling message
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

          // Send initial greeting in Mock mode
          if (!setup.useRealElevenLabs) {
            sendMockAudio(ws, streamSid);
          }
          break;

        case "media":
          // Twilio sends 20ms base64 mulaw audio chunks in data.media.payload
          if (setup.useRealElevenLabs && elevenLabsSocket && elevenLabsSocket.readyState === WebSocket.OPEN) {
            logger.info({ callId, payloadLength: data.media.payload ? data.media.payload.length : 0 }, "Forwarding Twilio audio chunk to ElevenLabs");
            elevenLabsSocket.send(JSON.stringify({
              event: "user_audio_chunk",
              user_audio_chunk: data.media.payload
            }));
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

  ws.on("close", (code, reason) => {
    logger.info({ callId, code, reason: reason ? reason.toString() : "" }, "Twilio stream WebSocket closed");
    cleanup();
  });

  // Helper to cleanup sockets and update DB
  async function cleanup() {
    if (isClosed) return;
    isClosed = true;
    clearInterval(pingInterval);

    try {
      logger.info({ callId }, "Closing Twilio stream WebSocket client connection");
      ws.close();
    } catch {}

    if (elevenLabsSocket) {
      try {
        logger.info({ callId }, "Closing ElevenLabs WebSocket connection");
        elevenLabsSocket.close();
      } catch {}
    }

    if (callRow) {
      // Update Call state to completed
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

      const { error: evErr2 } = await admin.from("call_events").insert({
        org_id: callRow.org_id,
        call_id: callId,
        kind: "twilio.completed",
        payload: { duration_sec: duration }
      });
      if (evErr2) {
        logger.error({ err: evErr2.message, callId }, "Failed to insert call event twilio.completed");
      }
    }
  }
}

// Sends a short silent or simple static tone to simulate audio output in mock/test runs
function sendMockAudio(ws, streamSid) {
  // 1 second of G.711 mu-law silence is 8000 bytes of 0xFF values
  const silence = Buffer.alloc(800, 0xFF).toString("base64");
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      event: "media",
      streamSid,
      media: {
        payload: silence
      }
    }));
  }
}

module.exports = { handleTwilioStream };

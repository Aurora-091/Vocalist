import { useState, useRef, useCallback } from "react";

export type Message = {
  message: string;
  source: "user" | "ai";
};

export type UseAgentConversationOptions = {
  onConnect?: () => void;
  onDisconnect?: (details?: any) => void;
  onError?: (message: string, context?: any) => void;
  onMessage?: (msg: Message) => void;
};

/**
 * Target sample rate for ElevenLabs Conversational AI.
 * The server negotiated ulaw_8000 — 8-bit µ-law compressed audio at 8kHz.
 * Both upstream (mic→server) and downstream (server→speaker) use this format.
 */
const TARGET_SAMPLE_RATE = 8000;

/**
 * AudioWorklet processor source code (runs in the audio rendering thread).
 *
 * Captures raw Float32 mic frames and posts them to the main thread via port.
 * We keep this processor minimal — all resampling/encoding happens on the main
 * thread to avoid complexity inside the worklet scope.
 */
const WORKLET_PROCESSOR_SRC = /* js */ `
class MicCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0 && input[0].length > 0) {
      // Copy the Float32 channel data so it survives the rendering quantum
      const channelData = new Float32Array(input[0]);
      this.port.postMessage(channelData);
    }
    return true; // Keep processor alive
  }
}

registerProcessor('mic-capture-processor', MicCaptureProcessor);
`;

export function useAgentConversation(options: UseAgentConversationOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────
  const wsRef = useRef<WebSocket | null>(null);

  // Playback context: forced to 16kHz so raw PCM buffers play at correct pitch
  const playbackCtxRef = useRef<AudioContext | null>(null);

  // Mic capture context: uses browser's native sample rate for clean capture
  const micCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Gapless playback timeline pointer
  const nextStartTimeRef = useRef<number>(0);

  // ── Helpers: µ-Law Codec ─────────────────────────────────────────────────
  //
  // ITU-T G.711 µ-law companding. The ElevenLabs server negotiated `ulaw_8000`,
  // meaning every audio byte on the wire is an 8-bit µ-law compressed sample
  // at 8000 Hz. We need both directions:
  //   • Downstream (decode): µ-law byte → linear Float32 for Web Audio playback
  //   • Upstream   (encode): linear Float32 from mic → µ-law byte for the server

  /**
   * DOWNSTREAM DECODER: Expand an array of 8-bit µ-law bytes into linear
   * Float32 samples normalized to [-1.0, 1.0].
   *
   * Algorithm (ITU-T G.711 standard):
   *   1. Flip all bits (~byte) to undo the wire-format inversion
   *   2. Extract sign (bit 7), exponent (bits 6–4), mantissa (bits 3–0)
   *   3. Reconstruct the 14-bit linear magnitude:
   *      magnitude = ((mantissa << 3) + 132) << exponent - 132
   *   4. Apply sign and normalize to Float32 range
   */
  const ulawDecode = useCallback((ulawBytes: Uint8Array): Float32Array => {
    const out = new Float32Array(ulawBytes.length);
    for (let i = 0; i < ulawBytes.length; i++) {
      // Step 1: Flip all bits (µ-law stores inverted on the wire)
      const u = ~ulawBytes[i] & 0xff;

      // Step 2: Extract components
      const sign = u & 0x80;         // Bit 7 = sign (1 = negative)
      const exponent = (u & 0x70) >> 4; // Bits 6-4 = exponent (0–7)
      const mantissa = u & 0x0f;     // Bits 3-0 = mantissa (0–15)

      // Step 3: Reconstruct linear magnitude
      //   Add bias of 132 (0x84) to the mantissa, shift by exponent,
      //   then subtract the bias to get the final linear value.
      let sample = (mantissa << 3) + 132; // mantissa * 8 + bias
      sample <<= exponent;                // scale by 2^exponent
      sample -= 132;                      // remove bias

      // Step 4: Apply sign and normalize to [-1.0, 1.0]
      out[i] = (sign !== 0 ? -sample : sample) / 32768.0;
    }
    return out;
  }, []);

  /**
   * UPSTREAM ENCODER: Compress a linear Float32 sample ([-1.0, 1.0]) into
   * a single 8-bit µ-law byte.
   *
   * This is the inverse of ulawDecode. We clamp, scale to Int16 range,
   * find the segment (exponent), extract the quantized mantissa, and
   * combine with the sign bit. The result is inverted per G.711 convention.
   */
  const float32ToUlaw = useCallback((float32Data: Float32Array): Uint8Array => {
    const BIAS = 132;       // µ-law bias (0x84)
    const CLIP = 32635;     // Max magnitude before clipping (0x7F7B)
    const out = new Uint8Array(float32Data.length);

    for (let i = 0; i < float32Data.length; i++) {
      // Scale Float32 [-1.0, 1.0] → Int16 [-32768, 32767]
      const clamped = Math.max(-1, Math.min(1, float32Data[i]));
      let sample = Math.round(clamped * 32767);

      // Determine sign and work with absolute magnitude
      let sign = 0;
      if (sample < 0) {
        sign = 0x80;
        sample = -sample;
      }

      // Add bias and clip
      sample = Math.min(sample + BIAS, CLIP);

      // Find the exponent (segment) — the position of the highest set bit
      // in the biased magnitude, searching from bit 12 down to bit 6
      let exponent = 7;
      const expMask = 0x4000; // Bit 14 (but we start from segment 7 down)
      for (let shift = exponent; shift > 0; shift--) {
        if (sample & (expMask >> shift)) break;
        exponent--;
      }

      // Extract the 4-bit mantissa from the appropriate position
      const mantissa = (sample >> (exponent + 3)) & 0x0f;

      // Combine sign + exponent + mantissa, then invert all bits (G.711)
      const ulawByte = ~(sign | (exponent << 4) | mantissa) & 0xff;
      out[i] = ulawByte;
    }
    return out;
  }, []);

  /**
   * Downsample Float32 audio from `srcRate` to `targetRate` using
   * linear interpolation. Returns a new Float32Array at the target rate.
   */
  const downsampleFloat32 = useCallback(
    (input: Float32Array, srcRate: number, targetRate: number): Float32Array => {
      if (srcRate === targetRate) {
        return input; // No resampling needed
      }

      const ratio = srcRate / targetRate;
      const outputLength = Math.floor(input.length / ratio);
      const output = new Float32Array(outputLength);

      for (let i = 0; i < outputLength; i++) {
        const srcIndex = i * ratio;
        const srcFloor = Math.floor(srcIndex);
        const srcCeil = Math.min(srcFloor + 1, input.length - 1);
        const frac = srcIndex - srcFloor;

        // Linear interpolation between adjacent source samples
        output[i] = input[srcFloor] * (1 - frac) + input[srcCeil] * frac;
      }

      return output;
    },
    []
  );

  /**
   * Convert a Uint8Array (µ-law bytes) to a base64-encoded string.
   * This is the wire format expected by ElevenLabs' user_audio_chunk event.
   */
  const uint8ToBase64 = useCallback((bytes: Uint8Array): string => {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }, []);

  // ── Upstream: Mic Capture ───────────────────────────────────────────────

  const startStreaming = async () => {
    console.log("[UPSTREAM] Activating mic capture pipeline…");

    try {
      // 1. Create a mic-specific AudioContext at the NATIVE sample rate.
      //    We do NOT force 16kHz here — the browser's mic hardware runs at
      //    44100 or 48000 Hz. Forcing 16kHz causes some browsers to deliver
      //    garbled/empty buffers. We downsample manually on the main thread.
      if (!micCtxRef.current) {
        micCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        console.log(
          `[UPSTREAM] Mic AudioContext created at native rate: ${micCtxRef.current.sampleRate} Hz`
        );
      }

      const micCtx = micCtxRef.current;
      if (micCtx.state === "suspended") {
        await micCtx.resume();
      }

      // 2. Request microphone access with echo/noise suppression
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      console.log("[UPSTREAM] Mic stream acquired.");

      // 3. Register AudioWorklet processor from an inline Blob URL.
      //    This avoids needing a separate .js file in /public.
      const blob = new Blob([WORKLET_PROCESSOR_SRC], {
        type: "application/javascript",
      });
      const workletUrl = URL.createObjectURL(blob);
      try {
        await micCtx.audioWorklet.addModule(workletUrl);
        console.log("[UPSTREAM] AudioWorklet processor registered.");
      } catch (workletErr) {
        // If it throws an error stating that the processor is already registered, catch it silently
        console.warn("[UPSTREAM] AudioWorklet module registration caught:", workletErr);
      }
      URL.revokeObjectURL(workletUrl);

      // 4. Wire: Mic → MediaStreamSource → AudioWorkletNode
      const sourceNode = micCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;

      const workletNode = new AudioWorkletNode(micCtx, "mic-capture-processor");
      workletNodeRef.current = workletNode;

      // 5. Listen for raw Float32 frames from the worklet
      const nativeSampleRate = micCtx.sampleRate;

      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const rawFloat32: Float32Array = event.data;

        // Pipeline: native rate Float32 → downsample to 8kHz → µ-law encode → base64
        // Step 1: Downsample from browser native rate (44100/48000) → 8000 Hz
        const resampled = downsampleFloat32(rawFloat32, nativeSampleRate, TARGET_SAMPLE_RATE);

        // Step 2: Compress linear Float32 samples into 8-bit µ-law bytes
        const ulawBytes = float32ToUlaw(resampled);

        // Step 3: Encode µ-law bytes as base64 and wrap in ElevenLabs JSON event
        const base64Chunk = uint8ToBase64(ulawBytes);
        ws.send(JSON.stringify({ user_audio_chunk: base64Chunk }));
      };

      // Connect the graph. The WorkletNode doesn't need to reach destination
      // since we're posting data via port.postMessage, but the graph must be
      // connected end-to-end for the processor's process() to be called.
      sourceNode.connect(workletNode);
      workletNode.connect(micCtx.destination);
      // The worklet's process() outputs silence by default (we never write to outputs).

      console.log("[UPSTREAM] Mic pipeline active. Streaming to WebSocket.");
    } catch (err) {
      console.error("[UPSTREAM] Failed to start mic stream:", err);
      options.onError?.("Failed to start microphone", err);
    }
  };

  // ── Downstream: AI Audio Playback (µ-law 8kHz) ─────────────────────────

  /**
   * Decode a base64 µ-law 8kHz audio chunk and schedule it for gapless playback.
   *
   * Byte pipeline:
   *   base64 string → binary string → Uint8Array (1 byte per µ-law sample)
   *   → µ-law expand → Float32Array → AudioBuffer(8kHz, mono)
   *   → BufferSourceNode → speakers
   */
  const playAudioChunk = async (base64Audio: string) => {
    try {
      // 1. Ensure we have a dedicated PLAYBACK AudioContext at exactly 8kHz.
      //    This guarantees µ-law samples play at correct pitch/speed.
      //    NOTE: Some browsers (Firefox) may not support 8kHz AudioContext.
      //    Chrome and Edge support it natively.
      if (!playbackCtxRef.current) {
        playbackCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)({ sampleRate: TARGET_SAMPLE_RATE });
        nextStartTimeRef.current = 0;
        console.log(
          `[DOWNSTREAM] Playback AudioContext created at ${playbackCtxRef.current.sampleRate} Hz`
        );
      }

      const playCtx = playbackCtxRef.current;
      if (playCtx.state === "suspended") {
        await playCtx.resume();
      }

      // 2. base64 → raw µ-law bytes (1 byte = 1 sample, NOT 2 bytes like PCM16)
      const binaryString = window.atob(base64Audio);
      const ulawBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        ulawBytes[i] = binaryString.charCodeAt(i);
      }

      // 3. Expand 8-bit µ-law → Float32 using ITU-T G.711 decoder
      //    Each byte becomes one Float32 sample in [-1.0, 1.0]
      const sampleCount = ulawBytes.length;
      const float32Samples = ulawDecode(ulawBytes);

      // 4. Create a Web Audio buffer at exactly 8000 Hz, mono
      const audioBuffer = playCtx.createBuffer(1, sampleCount, TARGET_SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(float32Samples);

      // 5. Schedule playback with gapless back-to-back timing
      const source = playCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(playCtx.destination);

      const now = playCtx.currentTime;
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now;
      }

      const scheduledStart = nextStartTimeRef.current;
      source.start(scheduledStart);
      nextStartTimeRef.current += audioBuffer.duration;

      console.log(
        `[DOWNSTREAM] CtxTime:${now.toFixed(3)}s | µ-law samples:${sampleCount} ` +
          `| Duration:${audioBuffer.duration.toFixed(3)}s ` +
          `| Scheduled:${scheduledStart.toFixed(3)}s→${nextStartTimeRef.current.toFixed(3)}s`
      );
    } catch (err) {
      console.error("[DOWNSTREAM] Failed to play audio chunk:", err);
    }
  };

  // ── WebSocket Connection ────────────────────────────────────────────────

  const startConversation = async (signedUrl: string) => {
    console.log(
      "[WS] Attempting connection to ElevenLabs ConvAI WebSocket…",
      signedUrl
    );

    return new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(signedUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[WS] WebSocket opened. Sending conversation_initiation_client_data.");

          // Tell ElevenLabs we want µ-law 8kHz in both directions
          ws.send(
            JSON.stringify({
              type: "conversation_initiation_client_data",
              conversation_config_override: {
                tts: {
                  agent_output_audio_format: "ulaw_8000",
                },
                asr: {
                  user_input_audio_format: "ulaw_8000",
                },
              },
              dynamic_variables: {
                date: "July 15, 2026",
                appointment_id: "test-appt-123",
                provider_id: "dr-michael-carter",
              },
            })
          );

          // Activate mic capture after WS is open so chunks have a destination
          startStreaming();
          options.onConnect?.();
          resolve();
        };

        ws.onmessage = async (event: MessageEvent) => {
          try {
            // ────────────────────────────────────────────────────────────────
            // GUARD: Handle raw binary frames (Blob / ArrayBuffer).
            // ElevenLabs ConvAI sends JSON-wrapped payloads, but we defend
            // against edge cases where a proxy or future API revision sends
            // raw binary PCM directly on the wire.
            // ────────────────────────────────────────────────────────────────
            if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
              console.warn(
                "👉 [ELEVENLABS RAW EVENT]: Received unexpected binary frame.",
                event.data instanceof Blob
                  ? `Blob size: ${event.data.size} bytes`
                  : `ArrayBuffer size: ${event.data.byteLength} bytes`
              );

              let arrayBuf: ArrayBuffer;
              if (event.data instanceof Blob) {
                arrayBuf = await event.data.arrayBuffer();
              } else {
                arrayBuf = event.data;
              }

              // Interpret raw binary as µ-law bytes at 8kHz (1 byte = 1 sample)
              const ulawBytes = new Uint8Array(arrayBuf);
              if (ulawBytes.length === 0) return;

              // Expand µ-law → Float32
              const float32Samples = ulawDecode(ulawBytes);
              const sampleCount = float32Samples.length;

              if (!playbackCtxRef.current) {
                playbackCtxRef.current = new (window.AudioContext ||
                  (window as any).webkitAudioContext)({ sampleRate: TARGET_SAMPLE_RATE });
                nextStartTimeRef.current = 0;
              }
              const playCtx = playbackCtxRef.current;
              if (playCtx.state === "suspended") await playCtx.resume();

              const audioBuffer = playCtx.createBuffer(1, sampleCount, TARGET_SAMPLE_RATE);
              audioBuffer.getChannelData(0).set(float32Samples);

              const source = playCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(playCtx.destination);

              const now = playCtx.currentTime;
              if (nextStartTimeRef.current < now) nextStartTimeRef.current = now;
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;

              console.log("[DOWNSTREAM] Played raw binary frame as µ-law 8kHz.");
              return;
            }

            // ────────────────────────────────────────────────────────────────
            // JSON STRING FRAMES — Standard ElevenLabs ConvAI protocol.
            // Every server event arrives as a JSON string with a `type` field.
            // ────────────────────────────────────────────────────────────────
            const data = JSON.parse(event.data as string);

            // 1. HIGH-VISIBILITY RAW PAYLOAD LOG
            //    Print the full parsed event so we can inspect every field
            //    arriving from the ElevenLabs backend in real time.
            console.log("👉 [ELEVENLABS RAW EVENT]:", data);

            switch (data.type) {
              // ── HEALTH CHECK: Ping / Pong Keepalive ───────────────────
              // ElevenLabs orchestrator sends { type: "ping", ping_event: { event_id: N } }
              // We MUST reply with the EXACT same event_id inside pong_event.
              // The Pydantic model `PongClientToOrchestratorEvent` requires:
              //   { type: "pong", pong_event: { event_id: <integer> } }
              // Failure to match this schema causes close code 1008.
              case "ping": {
                // 1. READ THE RAW PING ID:
                const incomingId = data.ping_event?.event_id;
                console.log(
                  `🏓 [PING] Heartbeat received. Raw incoming event_id: ${incomingId}`,
                  `| Type: ${typeof incomingId}`,
                  `| Raw ping_event:`, data.ping_event
                );

                if (ws.readyState === WebSocket.OPEN) {
                  // 2. SEND AN EXPLICIT INTEGER ASSIGNMENT:
                  const parsedInt = parseInt(String(incomingId), 10);
                  const isIntegerValid = !isNaN(parsedInt);
                  
                  let eventIdToSend: any;
                  if (isIntegerValid) {
                    eventIdToSend = parsedInt;
                  } else {
                    // 3. PROVIDE A STRUCTURAL BACKUP:
                    eventIdToSend = incomingId;
                  }

                  // ElevenLabs gateway schema expects client-to-server pongs to be a flat object:
                  // { type: "pong", event_id: <integer> }
                  const pongPayload = {
                    type: "pong",
                    event_id: Number(eventIdToSend),
                  };

                  console.log(
                    `🏓 [PONG] Event ID variable type before JSON.stringify(): ${typeof eventIdToSend}`
                  );
                  ws.send(JSON.stringify(pongPayload));
                  console.log(
                    `🏓 [PONG] Sent:`, JSON.stringify(pongPayload)
                  );
                }
                break;
              }

              // ── DOWNSTREAM AUDIO: base64 µ-law 8kHz ───────────────────
              // Server wraps streaming TTS audio inside:
              //   { type: "audio", audio_event: { audio_base_64: "..." } }
              // Each base64-decoded byte is one 8-bit µ-law sample at 8kHz.
              // We decode → expand µ-law → Float32 → schedule on 8kHz context.
              case "audio": {
                const b64 = data.audio_event?.audio_base_64;
                if (b64) {
                  // For µ-law: base64 chars ÷ 1.333 ≈ raw bytes = sample count (1 byte/sample)
                  const estimatedSamples = Math.floor((b64.length * 3) / 4);
                  console.log(
                    `🔊 [AUDIO] Received µ-law chunk: ${b64.length} base64 chars ` +
                      `(≈${estimatedSamples} µ-law samples @ 8kHz ≈ ${(estimatedSamples / 8000).toFixed(3)}s)`
                  );
                  await playAudioChunk(b64);
                } else {
                  console.warn(
                    "⚠️ [AUDIO] Received audio event with no audio_base_64 payload:",
                    data
                  );
                }
                break;
              }

              // ── USER TRANSCRIPT (ASR result) ──────────────────────────
              case "user_transcript": {
                const transcript =
                  data.user_transcript_event?.user_transcript ??
                  data.transcript ??
                  "";
                const isFinal = data.user_transcript_event?.is_final ?? false;
                console.log(
                  `🎤 [USER_TRANSCRIPT] ${isFinal ? "(FINAL)" : "(partial)"}: "${transcript}"`
                );
                options.onMessage?.({ source: "user", message: transcript });
                break;
              }

              // ── AGENT RESPONSE (LLM text chunk) ──────────────────────
              case "agent_response": {
                const response =
                  data.agent_response_event?.agent_response ??
                  data.response ??
                  "";
                console.log(`🤖 [AGENT_RESPONSE]: "${response}"`);
                options.onMessage?.({ source: "ai", message: response });
                break;
              }

              // ── AGENT RESPONSE COMPLETE ───────────────────────────────
              // Fired when the agent's full turn is finished (all audio +
              // text has been sent). Useful for UI state transitions.
              case "agent_response_complete": {
                console.log(
                  "✅ [AGENT_RESPONSE_COMPLETE] Agent finished full response turn.",
                  data.agent_response_complete_event ?? data
                );
                break;
              }

              // ── SPEAKING STATE ────────────────────────────────────────
              case "agent_speaking":
                console.log("🔈 [AGENT_SPEAKING] Agent started speaking.");
                setIsSpeaking(true);
                break;

              case "agent_stopped_speaking":
                console.log("🔇 [AGENT_STOPPED_SPEAKING] Agent stopped speaking.");
                setIsSpeaking(false);
                break;

              // ── CONVERSATION INIT METADATA ────────────────────────────
              // Sent once after the server accepts our initiation payload.
              // Contains the conversation_id, agent config echo, etc.
              case "conversation_initiation_metadata": {
                console.log(
                  "📋 [INIT_METADATA] Server accepted conversation init:",
                  data.conversation_initiation_metadata_event ?? data
                );
                break;
              }

              // ── INTERRUPTION ──────────────────────────────────────────
              case "interruption": {
                console.log(
                  "⚡ [INTERRUPTION] User interrupted agent.",
                  data.interruption_event ?? data
                );
                // Reset playback timeline to prevent stale scheduled buffers
                // from playing after the interruption
                nextStartTimeRef.current = 0;
                setIsSpeaking(false);
                break;
              }

              // ── CATCH-ALL: Unknown / future event types ───────────────
              default:
                console.warn(
                  `❓ [UNHANDLED EVENT] type="${data.type}". Full payload:`,
                  data
                );
                break;
            }
          } catch (e) {
            // Log parse failures with the raw payload for debugging
            console.error(
              "[WS] Failed to parse/handle message:",
              e,
              "| Raw payload:",
              typeof event.data === "string"
                ? event.data.substring(0, 500)
                : event.data
            );
          }
        };

        ws.onerror = (error) => {
          console.error("[WS] WebSocket error:", error);
          options.onError?.("WebSocket error", error);
        };

        ws.onclose = (event) => {
          console.log(
            `[WS] WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`
          );
          options.onDisconnect?.({
            code: event.code,
            reason: event.reason,
          });
          wsRef.current = null;
        };
      } catch (err: any) {
        console.error("[WS] Failed to construct WebSocket:", err);
        options.onError?.(err.message || "Failed to initialize WebSocket");
        reject(err);
      }
    });
  };

  // ── Teardown ────────────────────────────────────────────────────────────

  const endSession = async () => {
    // 1. Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, "User ended session");
      wsRef.current = null;
    }

    // 2. Tear down mic worklet and source
    if (workletNodeRef.current) {
      workletNodeRef.current.port.close();
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    // 3. Stop all mic tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // 4. Close both AudioContexts
    if (micCtxRef.current) {
      await micCtxRef.current.close();
      micCtxRef.current = null;
    }
    if (playbackCtxRef.current) {
      await playbackCtxRef.current.close();
      playbackCtxRef.current = null;
    }

    setIsSpeaking(false);
    console.log("[SESSION] Ended. All resources released.");
  };

  const getId = () => {
    // Generate a mock ID for the session tracking if needed
    return `session-${Math.random().toString(36).substring(2, 9)}`;
  };

  return {
    startConversation,
    endSession,
    isSpeaking,
    getId,
  };
}

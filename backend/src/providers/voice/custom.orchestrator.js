const WebSocket = require("ws");
const EventEmitter = require("events");
const logger = require("../../config/logger");

class CustomVoiceOrchestrator extends EventEmitter {
  constructor({ voiceId, apiKey, systemPrompt, onAudio }) {
    super();
    this.voiceId = voiceId || "21m00Tcm4TlvDq8ikWAM";
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY;
    this.systemPrompt = systemPrompt || "You are a helpful assistant.";
    this.onAudio = onAudio;
    this.transcriptHistory = [];
    this.sttSocket = null;
    this.ttsSocket = null;
    this.isClosed = false;

    this.initSockets();
  }

  initSockets() {
    if (!this.apiKey) {
      logger.error("Missing ELEVENLABS_API_KEY for CustomVoiceOrchestrator");
      return;
    }

    // 1. ElevenLabs Scribe v2 Realtime (STT) socket
    const sttUrl = "wss://api.elevenlabs.io/v1/scribe/v2/stream?model_id=scribe_v2_realtime&encoding=ulaw&sample_rate=8000";
    logger.info("Connecting to ElevenLabs Scribe Realtime (STT) WebSocket...");
    this.sttSocket = new WebSocket(sttUrl, {
      headers: {
        "xi-api-key": this.apiKey
      }
    });

    this.sttSocket.on("open", () => {
      logger.info("ElevenLabs Scribe Realtime (STT) WebSocket connected");
    });

    this.sttSocket.on("message", (data) => {
      this.handleSTTMessage(data);
    });

    this.sttSocket.on("error", (err) => {
      logger.error({ err: err.message }, "ElevenLabs Scribe Realtime WebSocket error");
    });

    this.sttSocket.on("close", () => {
      logger.info("ElevenLabs Scribe Realtime WebSocket closed");
      this.close();
    });

    // 2. ElevenLabs Flash v2.5 (TTS) socket
    const ttsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream-input?model_id=eleven_flash_v2_5&output_format=ulaw_8000`;
    logger.info({ voiceId: this.voiceId }, "Connecting to ElevenLabs Flash (TTS) WebSocket...");
    this.ttsSocket = new WebSocket(ttsUrl, {
      headers: {
        "xi-api-key": this.apiKey
      }
    });

    this.ttsSocket.on("open", () => {
      logger.info("ElevenLabs Flash (TTS) WebSocket connected");
      // Send initial configuration message
      try {
        this.ttsSocket.send(JSON.stringify({
          text: " ",
          generation_config: {
            chunk_length_schedule: [50, 100, 150, 200]
          }
        }));
      } catch (err) {
        logger.error({ err: err.message }, "Failed to send initial TTS config");
      }
    });

    this.ttsSocket.on("message", (data) => {
      this.handleTTSMessage(data);
    });

    this.ttsSocket.on("error", (err) => {
      logger.error({ err: err.message }, "ElevenLabs Flash TTS WebSocket error");
    });

    this.ttsSocket.on("close", () => {
      logger.info("ElevenLabs Flash TTS WebSocket closed");
      this.close();
    });
  }

  handleTwilioAudio(base64Payload) {
    if (this.isClosed) return;
    if (this.sttSocket && this.sttSocket.readyState === WebSocket.OPEN) {
      try {
        this.sttSocket.send(JSON.stringify({
          message_type: "input_audio_chunk",
          audio_base_64: base64Payload
        }));
      } catch (err) {
        logger.error({ err: err.message }, "Error sending audio to STT socket");
      }
    }
  }

  async handleSTTMessage(data) {
    if (this.isClosed) return;
    try {
      const msg = JSON.parse(data.toString());
      const isFinal = msg.is_final || msg.isFinal;
      const text = msg.text;

      if (text && text.trim()) {
        logger.info({ text, isFinal }, "STT transcription segment");
        if (isFinal) {
          this.transcriptHistory.push({ role: "user", content: text.trim() });
          await this.generateLLMResponse();
        }
      }
    } catch (err) {
      logger.error({ err: err.message }, "Error parsing STT message JSON");
    }
  }

  handleTTSMessage(data) {
    if (this.isClosed) return;
    try {
      const msg = JSON.parse(data.toString());
      if (msg.audio) {
        if (this.onAudio) {
          this.onAudio(msg.audio);
        }
      }
    } catch (err) {
      // If the message is raw binary instead of JSON string
      if (Buffer.isBuffer(data)) {
        if (this.onAudio) {
          this.onAudio(data.toString("base64"));
        }
      } else {
        logger.error({ err: err.message }, "Error processing TTS response");
      }
    }
  }

  async generateLLMResponse() {
    const historyText = this.transcriptHistory
      .map((entry) => `${entry.role === "user" ? "User" : "Assistant"}: ${entry.content}`)
      .join("\n");

    const prompt = `System Instructions: ${this.systemPrompt}\n\nConversation History:\n${historyText}\n\nAssistant:`;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${geminiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }]
              }
            ]
          })
        });

        if (!response.ok) {
          throw new Error(`Gemini API returned status: ${response.status}`);
        }

        let assistantText = "";
        let buffer = "";

        for await (const chunk of response.body) {
          if (this.isClosed) break;
          buffer += chunk.toString("utf8");

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            let jsonString = cleanLine;
            if (jsonString.startsWith("[")) jsonString = jsonString.slice(1);
            if (jsonString.startsWith(",")) jsonString = jsonString.slice(1);
            if (jsonString.endsWith("]")) jsonString = jsonString.slice(0, -1);
            if (jsonString.endsWith(",")) jsonString = jsonString.slice(0, -1);

            jsonString = jsonString.trim();
            if (!jsonString) continue;

            try {
              const parsed = JSON.parse(jsonString);
              const textPart = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textPart) {
                assistantText += textPart;
                this.streamTextToTTS(textPart);
              }
            } catch (err) {
              const match = jsonString.match(/"text":\s*"((?:[^"\\]|\\.)*)"/);
              if (match) {
                try {
                  const textPart = JSON.parse(`"${match[1]}"`);
                  if (textPart) {
                    assistantText += textPart;
                    this.streamTextToTTS(textPart);
                  }
                } catch {}
              }
            }
          }
        }

        if (buffer.trim()) {
          const match = buffer.match(/"text":\s*"((?:[^"\\]|\\.)*)"/);
          if (match) {
            try {
              const textPart = JSON.parse(`"${match[1]}"`);
              if (textPart) {
                assistantText += textPart;
                this.streamTextToTTS(textPart);
              }
            } catch {}
          }
        }

        this.endTTSStream();
        if (assistantText.trim()) {
          this.transcriptHistory.push({ role: "assistant", content: assistantText.trim() });
        }
      } catch (err) {
        logger.error({ err: err.message }, "Error streaming LLM response, falling back to mock text");
        await this.generateMockResponse();
      }
    } else {
      await this.generateMockResponse();
    }
  }

  async generateMockResponse() {
    const mockResponses = [
      "Hello! I am your voice assistant powered by our custom orchestration engine. How can I help you today?",
      "I hear you. Let me check the database for you. Is there anything else I can assist with?",
      "That sounds great! I am fully running on the new Node.js local orchestration engine now."
    ];
    const responseText = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    logger.info({ responseText }, "Generating mock LLM response stream");

    const words = responseText.split(" ");
    let assistantText = "";
    for (const word of words) {
      if (this.isClosed) return;
      const token = word + " ";
      assistantText += token;
      this.streamTextToTTS(token);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    this.endTTSStream();
    this.transcriptHistory.push({ role: "assistant", content: assistantText.trim() });
  }

  streamTextToTTS(text) {
    if (this.isClosed) return;
    if (this.ttsSocket && this.ttsSocket.readyState === WebSocket.OPEN) {
      try {
        this.ttsSocket.send(JSON.stringify({
          text: text,
          try_trigger_generation: true,
          generation_config: {
            chunk_length_schedule: [50, 100, 150, 200]
          }
        }));
      } catch (err) {
        logger.error({ err: err.message }, "Error sending text to TTS socket");
      }
    }
  }

  endTTSStream() {
    if (this.isClosed) return;
    if (this.ttsSocket && this.ttsSocket.readyState === WebSocket.OPEN) {
      try {
        this.ttsSocket.send(JSON.stringify({ text: "" }));
      } catch (err) {
        logger.error({ err: err.message }, "Error sending end of stream to TTS socket");
      }
    }
  }

  close() {
    if (this.isClosed) return;
    this.isClosed = true;

    if (this.sttSocket) {
      try { this.sttSocket.close(); } catch {}
    }
    if (this.ttsSocket) {
      try { this.ttsSocket.close(); } catch {}
    }

    this.emit("close");
  }
}

module.exports = CustomVoiceOrchestrator;

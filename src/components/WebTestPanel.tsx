import { useState, useEffect, useRef, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { Mic, MicOff, Phone, PhoneOff, Volume2, Wrench, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { captureEvent } from "@/lib/posthog";

type Message = { source: "user" | "ai"; text: string };

export type WebTestPanelProps = {
  agentId: string;
  agentName: string;
  onGoFix?: (notes: string) => void;
  onSessionStart?: () => void;
  transcriptHeight?: string;
};

const MAX_DURATION_SEC = 300;

export function WebTestPanel({
  agentId,
  agentName,
  onGoFix,
  onSessionStart,
  transcriptHeight = "h-[240px]",
}: WebTestPanelProps) {
  const [phase, setPhase] = useState<
    "idle" | "requesting-mic" | "connecting" | "active" | "ended"
  >("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [notes, setNotes] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const pendingCallIdRef = useRef<string | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      setPhase("active");
      setError(null);
      onSessionStart?.();
      captureEvent("web_test_started", { agent_id: agentId, agent_name: agentName });
      const convId = conversation.getId();
      if (pendingCallIdRef.current && convId) {
        api.patch(`/v1/calls/${pendingCallIdRef.current}`, { conversation_id: convId }).catch(() => {});
      }
    },
    onDisconnect: () => {
      setPhase("ended");
      stopTimer();
      captureEvent("web_test_ended", { agent_id: agentId, duration_sec: elapsed });
    },
    onError: (message: string) => {
      setError(message);
      setPhase("ended");
      stopTimer();
      captureEvent("web_test_error", { agent_id: agentId, error: message });
    },
    onMessage: ({ message, source }) => {
      setMessages((prev) => [...prev, { source, text: message }]);
    },
  });

  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= MAX_DURATION_SEC) {
          conversation.endSession();
          return prev + 1;
        }
        return prev + 1;
      });
    }, 1000);
  }, [conversation]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const handleStart = async () => {
    setError(null);
    setPhase("requesting-mic");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Please allow microphone permissions.");
      setPhase("idle");
      return;
    }
    setPhase("connecting");
    try {
      const { signed_url, call_id } = await api.post<{
        signed_url: string;
        agent_id: string;
        call_id: string;
      }>(`/v1/agents/${agentId}/web-session`);
      pendingCallIdRef.current = call_id ?? null;
      await conversation.startSession({ signedUrl: signed_url });
      startTimer();
    } catch (e: any) {
      setError(e.message || "Failed to start conversation");
      setPhase("idle");
    }
  };

  const handleEnd = async () => {
    await conversation.endSession();
    setPhase("ended");
    stopTimer();
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const remaining = MAX_DURATION_SEC - elapsed;

  return (
    <div className="space-y-3">
      {/* Status bar */}
      {phase === "active" && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="text-xs font-medium text-foreground">
              {conversation.isSpeaking ? "Agent speaking" : "Listening"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={remaining <= 60 ? "destructive" : "secondary"}
              className="text-[10px] font-mono tabular-nums num"
            >
              {formatTime(remaining)}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono tabular-nums num">
              {formatTime(elapsed)}
            </span>
          </div>
        </div>
      )}

      {/* Transcript */}
      <div
        ref={transcriptRef}
        className={`${transcriptHeight} overflow-y-auto rounded-lg border border-border bg-background p-3 space-y-2`}
      >
        {phase === "idle" && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <Mic className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Click start to begin a conversation with your agent
            </p>
          </div>
        )}
        {phase === "requesting-mic" && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground animate-pulse">
              Requesting microphone access…
            </p>
          </div>
        )}
        {phase === "connecting" && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground animate-pulse">
              Connecting to agent…
            </p>
          </div>
        )}
        {(phase === "active" || phase === "ended") && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              {phase === "active" ? "Waiting for conversation…" : "No messages exchanged"}
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.source === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.source === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Post-call notes */}
      {phase === "ended" && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <StickyNote className="w-3 h-3" />
            Quick notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What needs fixing? e.g. 'Agent didn't mention discount' or 'Tone too formal'"
            className="resize-none text-sm min-h-[60px]"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {phase === "idle" && (
          <Button onClick={handleStart} className="flex-1">
            <Mic className="w-4 h-4 mr-2" />
            Start conversation
          </Button>
        )}
        {(phase === "requesting-mic" || phase === "connecting") && (
          <Button disabled className="flex-1">
            <span className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
            {phase === "requesting-mic" ? "Requesting mic…" : "Connecting…"}
          </Button>
        )}
        {phase === "active" && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMuted((v) => !v)}
              className={muted ? "text-destructive border-destructive/30" : ""}
            >
              {muted ? <MicOff className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Button variant="destructive" onClick={handleEnd} className="flex-1">
              <PhoneOff className="w-4 h-4 mr-2" />
              End conversation
            </Button>
          </>
        )}
        {phase === "ended" && (
          <>
            <Button variant="outline" onClick={handleStart} className="flex-1">
              <Phone className="w-4 h-4 mr-2" />
              New conversation
            </Button>
            {onGoFix && (
              <Button onClick={() => onGoFix(notes)} className="flex-1">
                <Wrench className="w-4 h-4 mr-2" />
                Go fix it
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

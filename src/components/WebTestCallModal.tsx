import { useState, useEffect, useRef, useCallback } from "react";
import { useConversation } from "@11labs/react";
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { captureEvent } from "@/lib/posthog";

type Message = { source: "user" | "ai"; text: string };

type WebTestCallModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
};

const MAX_DURATION_SEC = 300;

export function WebTestCallModal({
  open,
  onOpenChange,
  agentId,
  agentName,
}: WebTestCallModalProps) {
  const [phase, setPhase] = useState<
    "idle" | "requesting-mic" | "connecting" | "active" | "ended"
  >("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onConnect: () => {
      setPhase("active");
      setError(null);
      captureEvent("web_test_started", { agent_id: agentId, agent_name: agentName });
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
    if (!open) {
      setPhase("idle");
      setMessages([]);
      setError(null);
      setElapsed(0);
      stopTimer();
    }
  }, [open, stopTimer]);

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
      const { signed_url } = await api.post<{ signed_url: string; agent_id: string }>(
        `/v1/agents/${agentId}/web-session`
      );

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

  const toggleMute = () => {
    setMuted((prev) => !prev);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const remaining = MAX_DURATION_SEC - elapsed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={phase !== "active"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Test conversation
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Talk to <span className="font-medium text-foreground">{agentName}</span> in your browser
          </p>
        </DialogHeader>

        {/* Status bar */}
        {phase === "active" && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-foreground">
                {conversation.isSpeaking ? "Agent speaking" : "Listening"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={remaining <= 60 ? "destructive" : "secondary"}
                className="text-[10px] font-mono tabular-nums"
              >
                {formatTime(remaining)}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono tabular-nums">
                {formatTime(elapsed)}
              </span>
            </div>
          </div>
        )}

        {/* Transcript panel */}
        <div
          ref={transcriptRef}
          className="h-[240px] overflow-y-auto rounded-lg border border-border bg-background p-3 space-y-2"
        >
          {phase === "idle" && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <Mic className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Click start to begin a conversation with your agent
              </p>
            </div>
          )}
          {phase === "requesting-mic" && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground animate-pulse">
                Requesting microphone access...
              </p>
            </div>
          )}
          {phase === "connecting" && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground animate-pulse">
                Connecting to agent...
              </p>
            </div>
          )}
          {(phase === "active" || phase === "ended") && messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">
                {phase === "active" ? "Waiting for conversation..." : "No messages exchanged"}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.source === "user" ? "justify-end" : "justify-start"}`}
            >
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

        {/* Error display */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
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
              {phase === "requesting-mic" ? "Requesting mic..." : "Connecting..."}
            </Button>
          )}
          {phase === "active" && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={toggleMute}
                className={muted ? "text-destructive border-destructive/30" : ""}
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="destructive"
                onClick={handleEnd}
                className="flex-1"
              >
                <PhoneOff className="w-4 h-4 mr-2" />
                End conversation
              </Button>
            </>
          )}
          {phase === "ended" && (
            <Button variant="outline" onClick={handleStart} className="flex-1">
              <Phone className="w-4 h-4 mr-2" />
              Start new conversation
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

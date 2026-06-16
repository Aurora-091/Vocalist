import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Square, Phone, CircleCheck as CheckCircle2 } from "lucide-react";

const TRANSCRIPT_TIMINGS: Array<{
  pct: number;
  speaker: "agent" | "customer";
  text: string;
}> = [
  { pct: 4, speaker: "agent", text: "Hi, this is Weeber calling on behalf of your store. Am I speaking with Priya?" },
  { pct: 12, speaker: "customer", text: "Yes, this is Priya." },
  { pct: 17, speaker: "agent", text: "Great. You placed an order for a wireless charger and a phone case — cash on delivery. I'm calling to confirm you'd still like us to ship it." },
  { pct: 30, speaker: "customer", text: "Yeah, I do. But can I change the colour of the case?" },
  { pct: 40, speaker: "agent", text: "Of course. We have black, navy, and sage green in stock. Which would you prefer?" },
  { pct: 52, speaker: "customer", text: "Sage green, please." },
  { pct: 58, speaker: "agent", text: "Done — I've updated the order to sage green. Your delivery address is 14 MG Road, Pune. Is that still correct?" },
  { pct: 72, speaker: "customer", text: "Yes, that's right." },
  { pct: 78, speaker: "agent", text: "Perfect. Your order is confirmed and will arrive within 3–5 business days. You'll get a tracking link by SMS shortly. Anything else I can help with?" },
  { pct: 90, speaker: "customer", text: "No, that's all. Thanks!" },
  { pct: 95, speaker: "agent", text: "You're welcome, Priya. Have a great day!" },
];

type Status = "idle" | "playing" | "done";

export function AgentDemoWidget() {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    setProgress(pct);

    let count = 0;
    for (let i = 0; i < TRANSCRIPT_TIMINGS.length; i++) {
      if (pct >= TRANSCRIPT_TIMINGS[i].pct) count = i + 1;
    }
    setVisibleLines(count);

    rafRef.current = requestAnimationFrame(updateProgress);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [visibleLines]);

  function handleToggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (status === "playing") {
      audio.pause();
      setStatus("idle");
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } else {
      if (status === "done") {
        audio.currentTime = 0;
        setVisibleLines(0);
        setProgress(0);
      }
      audio.play();
      setStatus("playing");
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  }

  function handleEnded() {
    setStatus("done");
    setProgress(100);
    setVisibleLines(TRANSCRIPT_TIMINGS.length);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }

  const elapsed = audioRef.current?.currentTime ?? 0;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <div className="demo-card">
      {/* Left: call interface */}
      <div className="demo-call-side">
        <div className="demo-caller-id">
          <div className="demo-avatar">
            <Phone className="w-4 h-4" />
          </div>
          <div>
            <div className="demo-caller-name">Weeber AI</div>
            <div className="demo-caller-label">COD Confirmation</div>
          </div>
        </div>

        {/* Waveform bars */}
        <div className={`demo-bars ${status === "playing" ? "demo-bars--playing" : ""}`}>
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className="demo-bar" style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>

        {/* Status & timer */}
        <div className="demo-call-meta">
          {status === "idle" && (
            <span className="demo-status demo-status--idle">Press play to listen</span>
          )}
          {status === "playing" && (
            <span className="demo-status demo-status--live">
              <span className="demo-live-dot" />
              AI calling... {timeStr}
            </span>
          )}
          {status === "done" && (
            <span className="demo-status demo-status--done">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Order Confirmed
            </span>
          )}
        </div>

        {/* Play/Stop button */}
        <button onClick={handleToggle} className="demo-play-btn" aria-label={status === "playing" ? "Stop" : "Play"}>
          {status === "playing" ? (
            <Square className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current translate-x-[1px]" />
          )}
          <span>{status === "playing" ? "Stop" : status === "done" ? "Replay" : "Play demo"}</span>
        </button>

        {/* Progress bar */}
        <div className="demo-progress-track">
          <div className="demo-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Right: transcript */}
      <div className="demo-transcript-side" ref={transcriptRef}>
        <div className="demo-transcript-header">Live transcript</div>
        <div className="demo-transcript-lines">
          {TRANSCRIPT_TIMINGS.slice(0, visibleLines).map((line, i) => (
            <div
              key={i}
              className={`demo-bubble ${line.speaker === "agent" ? "demo-bubble--agent" : "demo-bubble--customer"}`}
            >
              <span className="demo-bubble-label">
                {line.speaker === "agent" ? "Weeber" : "Customer"}
              </span>
              <span className="demo-bubble-text">{line.text}</span>
            </div>
          ))}
          {visibleLines === 0 && (
            <div className="demo-transcript-empty">
              Transcript appears here as the call plays...
            </div>
          )}
        </div>
      </div>

      <audio
        ref={audioRef}
        src="/audio/webber-cod-converstaion_FWQnrw94.mp3"
        preload="metadata"
        onEnded={handleEnded}
      />
    </div>
  );
}

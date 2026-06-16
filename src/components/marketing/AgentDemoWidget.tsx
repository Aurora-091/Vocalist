import { useState, useRef, useEffect } from "react";
import { Play, Square, ChevronDown } from "lucide-react";

const AGENTS = [
  { key: "cod", label: "COD Confirmation", audio: "/audio/webber-cod-converstaion_FWQnrw94.mp3" },
  { key: "cart", label: "Cart Recovery", audio: null },
  { key: "booking", label: "Appointment Booking", audio: null },
];

export function AgentDemoWidget() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);

  const active = AGENTS[activeIdx];

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function updateProgress() {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    setProgress(pct);
    rafRef.current = requestAnimationFrame(updateProgress);
  }

  function handleToggle() {
    const audio = audioRef.current;
    if (!audio || !active.audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } else {
      audio.play();
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  }

  function handleEnded() {
    setIsPlaying(false);
    setProgress(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }

  function handleTabClick(idx: number) {
    if (idx === activeIdx) return;
    const audio = audioRef.current;
    if (audio && isPlaying) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setProgress(0);
    setActiveIdx(idx);
  }

  return (
    <div className="demo-widget">
      {/* Top tabs */}
      <div className="flex items-center justify-center gap-1 px-4 pt-5 pb-2">
        {AGENTS.map((agent, idx) => (
          <button
            key={agent.key}
            onClick={() => handleTabClick(idx)}
            className={`demo-tab ${idx === activeIdx ? "demo-tab--active" : ""}`}
          >
            <span
              className="w-[7px] h-[7px] rounded-full flex-none"
              style={{
                background: idx === activeIdx ? "#22c55e" : "var(--m-text-muted)",
                opacity: idx === activeIdx ? 1 : 0.4,
              }}
            />
            {agent.label}
          </button>
        ))}
      </div>

      {/* Main orb area */}
      <div className="flex flex-col items-center justify-center py-10 md:py-16 relative">
        <div className={`demo-orb ${isPlaying ? "demo-orb--playing" : ""}`}>
          <div className="demo-orb-inner" />
          <div className="demo-orb-shine" />

          {/* Play button centered on orb */}
          <button
            onClick={handleToggle}
            disabled={!active.audio}
            className="demo-play-btn"
            aria-label={isPlaying ? "Stop playback" : "Play demo call"}
          >
            {isPlaying ? (
              <Square className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current translate-x-0.5" />
            )}
          </button>
        </div>

        {/* Progress ring */}
        {isPlaying && (
          <svg className="demo-progress-ring" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 46}`}
              strokeDashoffset={`${2 * Math.PI * 46 * (1 - progress / 100)}`}
              style={{ transition: "stroke-dashoffset 0.3s linear" }}
            />
          </svg>
        )}
      </div>

      {/* Bottom bar */}
      <div className="demo-bottom-bar">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="demo-agent-avatar" />
          <span className="text-[14px] font-semibold text-[var(--m-text)] truncate">
            {active.label} Agent
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[var(--m-text-muted)] flex-none" />
        </div>

        <a
          href="#waitlist"
          className="inline-flex items-center gap-1.5 h-9 px-5 text-[13px] font-semibold bg-[var(--m-accent-bg)] text-[var(--m-accent-fg)] rounded-lg hover:opacity-85 transition-opacity"
        >
          Join waitlist
        </a>
      </div>

      {active.audio && (
        <audio
          ref={audioRef}
          src={active.audio}
          preload="metadata"
          onEnded={handleEnded}
        />
      )}
    </div>
  );
}


import { useState, useRef, useEffect } from "react";
import { Play, Square } from "lucide-react";

const AGENTS = [
  { key: "cod", label: "COD Confirmation", audio: "/audio/webber-cod-converstaion_FWQnrw94.mp3" },
  { key: "cart", label: "Cart Recovery", audio: null },
  { key: "booking", label: "Appointment Booking", audio: null },
];

const ORB_PALETTES = [
  {
    gradient: "radial-gradient(ellipse at 35% 30%, #8ECAE6 0%, #3FADA8 30%, #1B6B6F 60%, #264653 100%)",
    shadow: "0 20px 60px -10px rgba(63,173,168,0.3), 0 8px 20px rgba(27,107,111,0.15), inset 0 -20px 40px rgba(38,70,83,0.4)",
    avatarGradient: "radial-gradient(circle at 40% 35%, #8ECAE6, #264653)",
  },
  {
    gradient: "radial-gradient(ellipse at 35% 30%, #FCD34D 0%, #F59E0B 30%, #B45309 60%, #78350F 100%)",
    shadow: "0 20px 60px -10px rgba(245,158,11,0.3), 0 8px 20px rgba(180,83,9,0.15), inset 0 -20px 40px rgba(120,53,15,0.4)",
    avatarGradient: "radial-gradient(circle at 40% 35%, #FCD34D, #78350F)",
  },
  {
    gradient: "radial-gradient(ellipse at 35% 30%, #FDA4AF 0%, #F43F5E 30%, #BE123C 60%, #881337 100%)",
    shadow: "0 20px 60px -10px rgba(244,63,94,0.3), 0 8px 20px rgba(190,18,60,0.15), inset 0 -20px 40px rgba(136,19,55,0.4)",
    avatarGradient: "radial-gradient(circle at 40% 35%, #FDA4AF, #881337)",
  },
];

export function AgentDemoWidget() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);

  const active = AGENTS[activeIdx];
  const palette = ORB_PALETTES[activeIdx];

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
                background: idx === activeIdx ? ORB_PALETTES[idx].avatarGradient : "var(--m-text-muted)",
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
          <div
            className="demo-orb-inner"
            style={{
              background: palette.gradient,
              boxShadow: palette.shadow,
              transition: "background 0.4s ease, box-shadow 0.4s ease",
            }}
          />
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


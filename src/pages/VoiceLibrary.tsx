import { useEffect, useRef, useState } from "react";
import { Search, Play, Pause, Volume2, Check } from "lucide-react";
import { listVoices } from "../lib/db";
import { Badge } from "../components/legacy-ui/Badge";
import { Skeleton } from "../components/legacy-ui/States";

type Voice = {
  id: string;
  voice_id: string;
  name: string;
  gender: string | null;
  accent: string | null;
  language_codes: string[];
  category: string;
  preview_url: string | null;
  description: string | null;
  tags: string[];
};

const LANGUAGES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  ru: "Russian",
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  tr: "Turkish",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  fi: "Finnish",
};

export default function VoiceLibrary({ onSelect, selectedVoiceId }: {
  onSelect?: (voiceId: string, voiceName: string) => void;
  selectedVoiceId?: string;
}) {
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function load() {
    try {
      const data = await listVoices({
        search: search || undefined,
        gender: gender || undefined,
        language: language || undefined,
      });
      setVoices(data);
    } catch {
      setVoices([]);
    }
  }

  useEffect(() => {
    load();
  }, [gender, language]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function playPreview(voice: Voice) {
    if (playing === voice.voice_id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (voice.preview_url) {
      const audio = new Audio(voice.preview_url);
      audio.onended = () => setPlaying(null);
      audio.onerror = () => setPlaying(null);
      audio.play().catch(() => setPlaying(null));
      audioRef.current = audio;
      setPlaying(voice.voice_id);
    }
  }

  const isSelector = !!onSelect;

  return (
    <div className="space-y-6">
      {!isSelector && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Voice Library</h1>
          <p className="text-sm text-text-muted mt-1">
            Browse and preview voices for your agents. Powered by ElevenLabs.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voices..."
            className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-surface text-sm"
          />
        </div>

        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="h-10 px-3 rounded-md border border-border bg-surface text-sm"
        >
          <option value="">All genders</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="nonbinary">Non-binary</option>
        </select>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="h-10 px-3 rounded-md border border-border bg-surface text-sm"
        >
          <option value="">All languages</option>
          {Object.entries(LANGUAGES).map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </div>

      {voices === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : voices.length === 0 ? (
        <div className="text-center py-12 text-sm text-text-muted">
          No voices found matching your filters.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voices.map((v) => {
            const isSelected = selectedVoiceId === v.voice_id;
            const isPlaying = playing === v.voice_id;
            return (
              <div
                key={v.id}
                className={`bg-surface border rounded-md p-5 transition-all ${
                  isSelected
                    ? "border-primary ring-1 ring-primary/20"
                    : "border-border hover:border-text/20"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {v.name}
                      {isSelected && <Check className="w-4 h-4 text-success" />}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {v.gender && <span className="capitalize">{v.gender}</span>}
                      {v.accent && <span> · {v.accent}</span>}
                    </div>
                  </div>
                  {v.preview_url && (
                    <button
                      onClick={() => playPreview(v)}
                      className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${
                        isPlaying
                          ? "bg-surface-2 text-text border border-border"
                          : "bg-surface-2 text-text-muted hover:text-text"
                      }`}
                      aria-label={isPlaying ? "Pause preview" : "Play preview"}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {v.description && (
                  <p className="mt-3 text-xs text-text-muted leading-relaxed line-clamp-2">
                    {v.description}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  {v.language_codes.map((code) => (
                    <Badge key={code} tone="info">
                      {LANGUAGES[code] || code}
                    </Badge>
                  ))}
                  {v.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} tone="neutral">{tag}</Badge>
                  ))}
                </div>

                {isSelector && (
                  <button
                    onClick={() => onSelect(v.voice_id, v.name)}
                    className={`mt-4 w-full h-9 rounded-md text-sm font-medium transition-colors ${
                      isSelected
                        ? "bg-surface-2 text-text border border-text/30 font-semibold"
                        : "bg-surface-2 text-text hover:bg-surface-2/80"
                    }`}
                  >
                    {isSelected ? "Selected" : "Select voice"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Search, Play, Pause, Check, TriangleAlert as AlertTriangle } from "lucide-react";
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

export default function VoiceLibrary({
  onSelect,
  selectedVoiceId,
  filterLanguages,
}: {
  onSelect?: (voiceId: string, voiceName: string) => void;
  selectedVoiceId?: string;
  filterLanguages?: string[];
}) {
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [accent, setAccent] = useState<string>("");
  const [activeTag, setActiveTag] = useState<string>("");
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

  const accents = voices
    ? Array.from(new Set(voices.map((v) => v.accent).filter(Boolean) as string[])).sort()
    : [];

  const allTags = voices
    ? Array.from(new Set(voices.flatMap((v) => v.tags))).sort()
    : [];

  const filtered = (voices || []).filter((v) => {
    if (accent && v.accent !== accent) return false;
    if (activeTag && !v.tags.includes(activeTag)) return false;
    return true;
  });

  const isSelector = !!onSelect;

  function isCompatible(voice: Voice) {
    if (!filterLanguages || filterLanguages.length === 0) return true;
    return filterLanguages.some((lang) => voice.language_codes.includes(lang));
  }

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

        {accents.length > 0 && (
          <select
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-10 px-3 rounded-md border border-border bg-surface text-sm"
          >
            <option value="">All accents</option>
            {accents.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
      </div>

      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-muted">Tags:</span>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? "" : tag)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                activeTag === tag
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-text-muted hover:border-text/30 hover:text-text"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {voices === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-text-muted">
          No voices found matching your filters.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => {
            const isSelected = selectedVoiceId === v.voice_id;
            const isPlaying = playing === v.voice_id;
            const compatible = isCompatible(v);
            return (
              <div
                key={v.id}
                className={`bg-surface border rounded-md p-5 transition-all ${
                  isSelected
                    ? "border-primary ring-1 ring-primary/20"
                    : !compatible
                    ? "border-warning/40 opacity-75"
                    : "border-border hover:border-text/20"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {v.name}
                      {isSelected && <Check className="w-4 h-4 text-success shrink-0" />}
                      {!compatible && filterLanguages && filterLanguages.length > 0 && (
                        <span
                          title={`Voice may not support ${filterLanguages.map((l) => LANGUAGES[l] || l).join(", ")}`}
                          className="inline-flex items-center gap-1 text-[10px] text-warning shrink-0"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Partial support
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {v.gender && <span className="capitalize">{v.gender}</span>}
                      {v.accent && <span> · {v.accent}</span>}
                    </div>
                  </div>
                  {v.preview_url && (
                    <button
                      onClick={() => playPreview(v)}
                      className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors shrink-0 ml-2 ${
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
                    <Badge
                      key={code}
                      tone={filterLanguages && filterLanguages.includes(code) ? "success" : "info"}
                    >
                      {LANGUAGES[code] || code}
                    </Badge>
                  ))}
                  {v.tags.slice(0, 3).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(activeTag === tag ? "" : tag)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        activeTag === tag
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-surface-2 text-text-muted hover:border-text/20"
                      }`}
                    >
                      {tag}
                    </button>
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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Play,
  Pause,
  Check,
  TriangleAlert as AlertTriangle,
  RefreshCw,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { listVoices, syncVoices } from "../lib/db";
import { getSession } from "../lib/supabase";
import {
  USE_CASES,
  USE_CASE_MAP,
  deriveUseCases,
  primaryUseCase,
  voiceInitials,
  type UseCaseId,
} from "../lib/voiceCategories";
import { Skeleton } from "../components/legacy-ui/States";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";

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
  use_cases?: string[] | null;
  featured?: boolean | null;
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

const SECTION_LIMIT = 8;

type PlayerState = {
  voiceId: string | null;
  progress: number;
  loading: boolean;
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
  const [gender, setGender] = useState<string>("all");
  const [language, setLanguage] = useState<string>("all");
  const [accent, setAccent] = useState<string>("all");
  const [category, setCategory] = useState<UseCaseId | "all">("all");
  const [canSync, setCanSync] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [player, setPlayer] = useState<PlayerState>({
    voiceId: null,
    progress: 0,
    loading: false,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isSelector = !!onSelect;

  async function load() {
    try {
      const data = await listVoices({
        search: search || undefined,
        gender: gender !== "all" ? gender : undefined,
        language: language !== "all" ? language : undefined,
      });
      setVoices(data as Voice[]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (isSelector) return;
    getSession().then((s) => {
      setCanSync(s?.role === "admin" || s?.role === "owner");
    });
  }, [isSelector]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  function playPreview(voice: Voice) {
    if (player.voiceId === voice.voice_id) {
      audioRef.current?.pause();
      setPlayer({ voiceId: null, progress: 0, loading: false });
      return;
    }
    audioRef.current?.pause();
    if (!voice.preview_url) return;

    const audio = new Audio(voice.preview_url);
    audioRef.current = audio;
    setPlayer({ voiceId: voice.voice_id, progress: 0, loading: true });

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setPlayer((p) =>
          p.voiceId === voice.voice_id
            ? { ...p, progress: audio.currentTime / audio.duration, loading: false }
            : p,
        );
      }
    };
    audio.onplaying = () =>
      setPlayer((p) => (p.voiceId === voice.voice_id ? { ...p, loading: false } : p));
    audio.onended = () => setPlayer({ voiceId: null, progress: 0, loading: false });
    audio.onerror = () => {
      setPlayer({ voiceId: null, progress: 0, loading: false });
      toast.error("Couldn't play this preview.");
    };
    audio.play().catch(() => {
      setPlayer({ voiceId: null, progress: 0, loading: false });
    });
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await syncVoices();
      toast.success(`Synced ${res.count} voices from ElevenLabs.`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Voice sync failed. Check your ElevenLabs API key.");
    } finally {
      setSyncing(false);
    }
  }

  function isCompatible(voice: Voice) {
    if (!filterLanguages || filterLanguages.length === 0) return true;
    return filterLanguages.some((lang) => voice.language_codes.includes(lang));
  }

  const accents = useMemo(
    () =>
      voices
        ? Array.from(new Set(voices.map((v) => v.accent).filter(Boolean) as string[])).sort()
        : [],
    [voices],
  );

  // Apply secondary (client-side) filters: accent + category.
  const filtered = useMemo(() => {
    return (voices || []).filter((v) => {
      if (accent !== "all" && v.accent !== accent) return false;
      if (category !== "all" && !deriveUseCases(v).includes(category)) return false;
      return true;
    });
  }, [voices, accent, category]);

  // Count per category (for chips), based on current search/gender/language/accent.
  const categoryCounts = useMemo(() => {
    const base = (voices || []).filter((v) => accent === "all" || v.accent === accent);
    const counts: Record<string, number> = { all: base.length };
    for (const v of base) {
      for (const id of deriveUseCases(v)) counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }, [voices, accent]);

  const showGrouped = category === "all" && !search;

  const featured = useMemo(() => {
    const pool = filtered.filter((v) => v.featured);
    const list = (pool.length > 0 ? pool : filtered).slice(0, 4);
    return list;
  }, [filtered]);

  const grouped = useMemo(() => {
    if (!showGrouped) return [];
    return USE_CASES.map((uc) => ({
      def: uc,
      voices: filtered.filter((v) => deriveUseCases(v).includes(uc.id)),
    })).filter((g) => g.voices.length > 0);
  }, [filtered, showGrouped]);

  const playerProps = { player, onPlay: playPreview, selectedVoiceId, isSelector, onSelect, filterLanguages, isCompatible };

  return (
    <div className="flex flex-col gap-6">
      {!isSelector && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">Voices</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-prose">
              Find the right voice for the job. Browse by what your customers are calling about
              and preview instantly.
            </p>
          </div>
          {canSync && (
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync from ElevenLabs"}
            </Button>
          )}
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voices by name or style..."
              className="pl-9"
              aria-label="Search voices"
            />
          </div>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger className="w-[140px]" aria-label="Filter by gender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All genders</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="nonbinary">Non-binary</SelectItem>
            </SelectContent>
          </Select>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-[150px]" aria-label="Filter by language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              {Object.entries(LANGUAGES).map(([code, label]) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {accents.length > 0 && (
            <Select value={accent} onValueChange={setAccent}>
              <SelectTrigger className="w-[140px]" aria-label="Filter by accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accents</SelectItem>
                {accents.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Use-case category chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <CategoryChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="All voices"
            count={categoryCounts.all}
          />
          {USE_CASES.map((uc) => (
            <CategoryChip
              key={uc.id}
              active={category === uc.id}
              onClick={() => setCategory(uc.id)}
              label={uc.label}
              count={categoryCounts[uc.id] || 0}
              icon={<uc.icon className="size-3.5" />}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      {voices === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState search={search} canSync={canSync} onSync={handleSync} syncing={syncing} />
      ) : showGrouped ? (
        <div className="flex flex-col gap-8">
          {/* Featured row */}
          {!isSelector && featured.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-foreground" />
                <h2 className="text-sm font-semibold tracking-tight">Popular voices</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {featured.map((v) => (
                  <VoiceCard key={v.id} voice={v} {...playerProps} />
                ))}
              </div>
            </section>
          )}

          {grouped.map(({ def, voices: list }) => (
            <section key={def.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex size-7 items-center justify-center rounded-lg ${def.tint.bg} ${def.tint.text}`}
                  >
                    <def.icon className="size-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight leading-none">
                      {def.label}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                      {def.blurb}
                    </p>
                  </div>
                </div>
                {list.length > SECTION_LIMIT && (
                  <button
                    onClick={() => setCategory(def.id)}
                    className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    See all {list.length}
                    <ChevronRight className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.slice(0, SECTION_LIMIT).map((v) => (
                  <VoiceCard key={v.id} voice={v} {...playerProps} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {category !== "all" && (
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "voice" : "voices"} in{" "}
              <span className="text-foreground font-medium">{USE_CASE_MAP[category].label}</span>
            </p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((v) => (
              <VoiceCard key={v.id} voice={v} {...playerProps} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30"
      }`}
    >
      {icon}
      {label}
      <span className={active ? "text-background/70" : "text-muted-foreground/70"}>{count}</span>
    </button>
  );
}

function VoiceCard({
  voice,
  player,
  onPlay,
  selectedVoiceId,
  isSelector,
  onSelect,
  filterLanguages,
  isCompatible,
}: {
  voice: Voice;
  player: PlayerState;
  onPlay: (v: Voice) => void;
  selectedVoiceId?: string;
  isSelector: boolean;
  onSelect?: (voiceId: string, voiceName: string) => void;
  filterLanguages?: string[];
  isCompatible: (v: Voice) => boolean;
}) {
  const isSelected = selectedVoiceId === voice.voice_id;
  const isPlaying = player.voiceId === voice.voice_id;
  const isLoading = isPlaying && player.loading;
  const compatible = isCompatible(voice);
  const uc = primaryUseCase(voice);
  const hasPreview = !!voice.preview_url;

  const langLabel = voice.language_codes[0] ? LANGUAGES[voice.language_codes[0]] || voice.language_codes[0] : null;
  const extraLangs = voice.language_codes.length - 1;

  function handleCardClick() {
    if (isSelector && onSelect) onSelect(voice.voice_id, voice.name);
  }

  return (
    <div
      onClick={handleCardClick}
      className={`group relative flex flex-col rounded-xl border bg-card p-3.5 transition-all ${
        isSelected
          ? "border-foreground ring-1 ring-foreground/15"
          : !compatible
            ? "border-amber-500/40"
            : "border-border hover:border-foreground/25 hover:shadow-sm"
      } ${isSelector ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar / play */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasPreview) onPlay(voice);
          }}
          disabled={!hasPreview}
          aria-label={isPlaying ? `Pause ${voice.name} preview` : `Play ${voice.name} preview`}
          className={`relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg ${uc.tint.bg} ${uc.tint.text} ${
            hasPreview ? "cursor-pointer" : "cursor-default"
          }`}
        >
          <span
            className={`text-sm font-semibold transition-opacity ${
              hasPreview ? "group-hover:opacity-0" : ""
            } ${isPlaying ? "opacity-0" : ""}`}
          >
            {voiceInitials(voice.name)}
          </span>
          {hasPreview && (
            <span
              className={`absolute inset-0 flex items-center justify-center bg-foreground/85 text-background transition-opacity ${
                isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              {isLoading ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="size-4 fill-current" />
              ) : (
                <Play className="size-4 fill-current" />
              )}
            </span>
          )}
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{voice.name}</span>
            {isSelected && <Check className="size-3.5 shrink-0 text-foreground" />}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground capitalize">
            {[voice.gender, voice.accent].filter(Boolean).join(" · ") || uc.label}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${uc.tint.bg} ${uc.tint.text}`}
            >
              <uc.icon className="size-3" />
              {uc.label}
            </span>
            {langLabel && (
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {langLabel}
                {extraLangs > 0 ? ` +${extraLangs}` : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {!compatible && filterLanguages && filterLanguages.length > 0 && (
        <div className="mt-2.5 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3" />
          May not support {filterLanguages.map((l) => LANGUAGES[l] || l).join(", ")}
        </div>
      )}

      {isSelector && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(voice.voice_id, voice.name);
          }}
          className={`mt-3 h-8 w-full rounded-md text-xs font-medium transition-colors ${
            isSelected
              ? "border border-foreground/30 bg-secondary text-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {isSelected ? "Selected" : "Use this voice"}
        </button>
      )}

      {/* Progress bar */}
      {isPlaying && (
        <div className="absolute inset-x-3.5 bottom-0 h-0.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-foreground transition-[width] duration-150"
            style={{ width: `${Math.round(player.progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function EmptyState({
  search,
  canSync,
  onSync,
  syncing,
}: {
  search: string;
  canSync: boolean;
  onSync: () => void;
  syncing: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
      <Search className="size-6 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">No voices found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {search ? "Try a different search or clear your filters." : "Your voice catalog is empty."}
        </p>
      </div>
      {canSync && !search && (
        <Button variant="outline" size="sm" onClick={onSync} disabled={syncing}>
          <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync from ElevenLabs"}
        </Button>
      )}
    </div>
  );
}

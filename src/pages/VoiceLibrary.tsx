import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Play, Pause, Check, TriangleAlert as AlertTriangle, RefreshCw, Sparkles, ChevronRight, Plus, Loader as Loader2, Globe } from "lucide-react";
import { listVoices, syncVoices, listAgents } from "../lib/db";
import { getSession } from "../lib/supabase";
import { api } from "../lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  USE_CASES,
  USE_CASE_MAP,
  deriveUseCases,
  primaryUseCase,
  type UseCaseId,
} from "../lib/voiceCategories";
import { Skeleton } from "@/components/ui/skeleton";
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

const SECTION_LIMIT = 12;

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
  const isSelector = !!onSelect;

  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<string>("all");
  const [language, setLanguage] = useState<string>("all");
  const [accent, setAccent] = useState<string>("all");
  const [category, setCategory] = useState<UseCaseId | "all" | "multilingual">("all");
  const [canSync, setCanSync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);

  const loadAgents = () => {
    if (!isSelector) {
      listAgents().then(setAgents).catch(() => {});
    }
  };

  useEffect(() => {
    loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelector]);

  const [player, setPlayer] = useState<PlayerState>({
    voiceId: null,
    progress: 0,
    loading: false,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function isMultilingual(voice: Voice) {
    return voice.language_codes.length > 1;
  }

  const accents = useMemo(
    () =>
      voices
        ? Array.from(new Set(voices.map((v) => v.accent).filter(Boolean) as string[])).sort()
        : [],
    [voices],
  );

  const filtered = useMemo(() => {
    return (voices || []).filter((v) => {
      if (accent !== "all" && v.accent !== accent) return false;
      if (category === "multilingual") return isMultilingual(v);
      if (category !== "all" && !deriveUseCases(v).includes(category)) return false;
      return true;
    });
  }, [voices, accent, category]);

  const multilingualCount = useMemo(
    () => (voices || []).filter((v) => (accent === "all" || v.accent === accent) && isMultilingual(v)).length,
    [voices, accent],
  );

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
    const list = (pool.length > 0 ? pool : filtered).slice(0, 6);
    return list;
  }, [filtered]);

  const grouped = useMemo(() => {
    if (!showGrouped) return [];
    const multilingualVoices = filtered.filter(isMultilingual);
    const groups = USE_CASES.map((uc) => ({
      def: uc,
      voices: filtered.filter((v) => deriveUseCases(v).includes(uc.id)),
    })).filter((g) => g.voices.length > 0);

    if (multilingualVoices.length > 0) {
      return [
        {
          def: {
            id: "multilingual" as const,
            label: "Multilingual",
            blurb: "Voices that switch between languages mid-conversation.",
            icon: Globe,
            tint: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/30" },
          },
          voices: multilingualVoices,
        },
        ...groups,
      ];
    }
    return groups;
  }, [filtered, showGrouped]);

  const playerProps = {
    player,
    onPlay: playPreview,
    selectedVoiceId,
    isSelector,
    onSelect,
    filterLanguages,
    isCompatible,
    agents,
    onAssignSuccess: loadAgents,
  };

  return (
    <div className="flex flex-col gap-6">
      {!isSelector && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">Voices</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-prose">
              Find the right voice for the job. Browse by use case, language, or accent and preview instantly.
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

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-4 -mb-4 pt-1 border-b border-border/50">
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
              <SelectTrigger className="w-[130px]" aria-label="Filter by gender">
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
              <SelectTrigger className="w-[140px]" aria-label="Filter by language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All languages</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                {Object.entries(LANGUAGES)
                  .filter(([code]) => code !== "hi")
                  .map(([code, label]) => (
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

          {/* Category chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            <CategoryChip
              active={category === "all"}
              onClick={() => setCategory("all")}
              label="All voices"
              count={categoryCounts.all}
            />
            <CategoryChip
              active={category === "multilingual"}
              onClick={() => setCategory("multilingual")}
              label="Multilingual"
              count={multilingualCount}
              icon={<Globe className="size-3.5" />}
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
      </div>

      {/* Content */}
      {voices === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(9)].map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState search={search} canSync={canSync} onSync={handleSync} syncing={syncing} />
      ) : showGrouped ? (
        <div className="flex flex-col gap-10">
          {/* Featured row */}
          {!isSelector && featured.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-foreground" />
                <h2 className="text-sm font-semibold tracking-tight">Popular voices</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
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
                    onClick={() => setCategory(def.id as any)}
                    className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    See all {list.length}
                    <ChevronRight className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
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
              <span className="text-foreground font-medium">
                {category === "multilingual" ? "Multilingual" : USE_CASE_MAP[category].label}
              </span>
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
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

const LANGUAGE_FLAGS: Record<string, string> = {
  en: "EN",
  es: "ES",
  fr: "FR",
  de: "DE",
  it: "IT",
  pt: "PT",
  nl: "NL",
  pl: "PL",
  ru: "RU",
  ja: "JA",
  zh: "ZH",
  ko: "KO",
  ar: "AR",
  hi: "HI",
  tr: "TR",
  sv: "SV",
  da: "DA",
  no: "NO",
  fi: "FI",
};

function getVoiceGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  const s = 75 + (Math.abs(hash >> 8) % 15);
  const l = 55 + (Math.abs(hash >> 16) % 15);
  const h2 = (h + 60) % 360;
  return `linear-gradient(135deg, hsl(${h}, ${s}%, ${l}%), hsl(${h2}, ${s + 5}%, ${l - 10}%))`;
}

function AssignToAgentButton({
  voice,
  agents,
  onAssignSuccess,
}: {
  voice: Voice;
  agents: any[];
  onAssignSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  async function handleAssign(agentId: string, agentName: string) {
    setAssigningId(agentId);
    try {
      await api.patch(`/v1/agents/${agentId}`, { voice_id: voice.voice_id });
      toast.success(`Assigned "${voice.name}" to "${agentName}".`);
      onAssignSuccess();
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign voice to agent.");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
          aria-label={`Assign ${voice.name} to an agent`}
        >
          <Plus className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-1.5"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1 select-none">
          Assign to Agent
        </div>
        {agents.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            No agents available
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
            {agents.map((agent) => {
              const isAssigned = agent.voice_id === voice.voice_id;
              const isPending = assigningId === agent.id;
              return (
                <button
                  key={agent.id}
                  disabled={isPending || isAssigned}
                  onClick={() => handleAssign(agent.id, agent.name)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-left rounded-md hover:bg-muted/70 disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <span className="truncate max-w-[150px]">{agent.name}</span>
                  {isPending ? (
                    <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  ) : isAssigned ? (
                    <Check className="size-3 text-foreground" />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function VoiceCard({
  voice,
  player,
  onPlay,
  selectedVoiceId,
  isSelector,
  onSelect,
  _filterLanguages,
  isCompatible,
  agents,
  onAssignSuccess,
}: {
  voice: Voice;
  player: PlayerState;
  onPlay: (v: Voice) => void;
  selectedVoiceId?: string;
  isSelector: boolean;
  onSelect?: (voiceId: string, voiceName: string) => void;
  filterLanguages?: string[];
  isCompatible: (v: Voice) => boolean;
  agents: any[];
  onAssignSuccess: () => void;
}) {
  const isSelected = selectedVoiceId === voice.voice_id;
  const isPlaying = player.voiceId === voice.voice_id;
  const isLoading = isPlaying && player.loading;
  const compatible = isCompatible(voice);
  const uc = primaryUseCase(voice);
  const hasPreview = !!voice.preview_url;
  const multilingual = voice.language_codes.length > 1;

  function handleCardClick() {
    if (isSelector && onSelect) onSelect(voice.voice_id, voice.name);
  }

  return (
    <div
      onClick={handleCardClick}
      className={`group relative flex flex-col justify-between p-3 rounded-xl border transition-all duration-150 ${
        isSelected
          ? "border-foreground/50 bg-muted/60 shadow-sm"
          : !compatible
            ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
            : "border-border bg-card hover:border-foreground/20 hover:shadow-sm"
      } ${isSelector ? "cursor-pointer" : ""}`}
    >
      {/* Top row: avatar + name + play */}
      <div className="flex items-center gap-2.5">
        {/* Avatar with play overlay */}
        <div className="relative size-9 shrink-0 rounded-full overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ background: getVoiceGradient(voice.name) }}
          />
          {hasPreview && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay(voice);
              }}
              aria-label={isPlaying ? `Pause ${voice.name}` : `Play ${voice.name}`}
              className={`absolute inset-0 flex items-center justify-center bg-black/40 text-white transition-opacity duration-150 cursor-pointer ${
                isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              {isLoading ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="size-3.5 fill-current" />
              ) : (
                <Play className="size-3.5 fill-current" />
              )}
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground leading-tight">{voice.name}</span>
            {isSelected && <Check className="size-3.5 shrink-0 text-foreground" />}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {voice.gender && (
              <span className="text-[10px] text-muted-foreground capitalize">{voice.gender}</span>
            )}
            {voice.accent && (
              <>
                <span className="text-muted-foreground/40 text-[10px]">/</span>
                <span className="text-[10px] text-muted-foreground">{voice.accent}</span>
              </>
            )}
          </div>
        </div>

        {/* Waveform */}
        {isPlaying && !isLoading && (
          <div className="flex items-center gap-[2px] h-3 px-1 select-none">
            <div className="w-[2px] h-full bg-foreground/70 rounded-full animate-[waveanim_1.2s_ease-in-out_infinite_0s] origin-center" />
            <div className="w-[2px] h-full bg-foreground/70 rounded-full animate-[waveanim_1.2s_ease-in-out_infinite_0.2s] origin-center" />
            <div className="w-[2px] h-full bg-foreground/70 rounded-full animate-[waveanim_1.2s_ease-in-out_infinite_0.4s] origin-center" />
          </div>
        )}
      </div>

      {/* Bottom row: tags + action */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Use case pill */}
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide shrink-0">
            <uc.icon className="size-2.5" />
            {uc.label}
          </span>
          {/* Multilingual badge */}
          {multilingual && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-0.5 text-[10px] font-medium shrink-0">
              <Globe className="size-2.5" />
              {voice.language_codes.length} langs
            </span>
          )}
          {/* Language codes */}
          {!multilingual && voice.language_codes[0] && (
            <span className="text-[10px] text-muted-foreground font-medium shrink-0">
              {LANGUAGE_FLAGS[voice.language_codes[0]] || voice.language_codes[0].toUpperCase()}
            </span>
          )}
          {!compatible && (
            <span className="text-amber-500 shrink-0" title="May not support requested languages">
              <AlertTriangle className="size-3" />
            </span>
          )}
        </div>

        {/* Action */}
        {isSelector ? (
          <Button
            size="sm"
            variant={isSelected ? "outline" : "secondary"}
            className="h-6 px-2 text-[10px] shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(voice.voice_id, voice.name);
            }}
          >
            {isSelected ? "Selected" : "Use"}
          </Button>
        ) : (
          <AssignToAgentButton
            voice={voice}
            agents={agents}
            onAssignSuccess={onAssignSuccess}
          />
        )}
      </div>
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

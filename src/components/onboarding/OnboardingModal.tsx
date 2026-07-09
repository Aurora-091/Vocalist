import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Check, ArrowRight, Loader as Loader2, Mic, ShoppingBag, Activity, Building2, Phone } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { WeeberLogo } from "@/components/WeeberLogo";
import { ConversationPanel } from "./ConversationPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { api } from "@/lib/api";
import { listAgentPresets, listVoices, getOrg, updateOrg, updateOnboardingStep } from "@/lib/db";
import { toast } from "sonner";
import type { VerticalKey } from "@/config/verticals";
import { useVertical } from "@/lib/VerticalContext";
import { cn } from "@/lib/utils";

type Preset = {
  id: string;
  vertical_key: string;
  preset_key: string;
  name: string;
  description: string;
  direction: string;
  persona: any;
  tools: any[];
  voice_id: string | null;
  voice_name: string | null;
  languages: string[];
  consent_required: boolean;
  analysis_config?: any;
};

type Voice = {
  voice_id: string;
  name: string;
  labels?: { accent?: string; gender?: string; use_case?: string };
  preview_url?: string;
};

const STEP_KEYS = ["template", "business", "voice", "test"] as const;
type StepKey = (typeof STEP_KEYS)[number];

const STEP_LABELS: Record<StepKey, string> = {
  template: "Template",
  business: "Business",
  voice: "Voice",
  test: "Test call",
};

const STEP_TITLES: Record<StepKey, string> = {
  template: "What kind of business do you run?",
  business: "Tell us about your business",
  voice: "Pick your agent's voice",
  test: "Talk to your agent",
};

const STEP_SUBTITLES: Record<StepKey, string> = {
  template: "Pick the flow that matches your calls.",
  business: "Your agent will greet callers with your business name.",
  voice: "Your agent will use this voice on every call.",
  test: "Make a live browser call right now to hear it in action.",
};

const VERTICAL_ICON: Record<string, ReactNode> = {
  shopify: <ShoppingBag className="w-3.5 h-3.5" />,
  ecommerce: <ShoppingBag className="w-3.5 h-3.5" />,
  clinic: <Activity className="w-3.5 h-3.5" />,
  healthcare: <Activity className="w-3.5 h-3.5" />,
  hotel: <Building2 className="w-3.5 h-3.5" />,
  hospitality: <Building2 className="w-3.5 h-3.5" />,
};

type OnboardingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
};

export function OnboardingModal({ open, onOpenChange, onComplete }: OnboardingModalProps) {
  const isMobile = useIsMobile();
  const { setVertical: persistVertical } = useVertical();

  const [step, setStep] = useState(0);
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [activeVerticalTab, setActiveVerticalTab] = useState<string>("all");
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [timezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  const currentKey = STEP_KEYS[step];

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const data = await listAgentPresets(undefined);
        setPresets(data);
      } catch {
        setPresets([]);
      }
    })();
    (async () => {
      const org = await getOrg();
      if (org?.name) setBusinessName(org.name);
    })();
  }, [open]);

  useEffect(() => {
    if (step === 2 && voices.length === 0) {
      (async () => {
        try {
          const data = await listVoices({ limit: 50 });
          setVoices(data || []);
          if (selectedPreset?.voice_id) {
            setSelectedVoice(selectedPreset.voice_id);
          } else if (data?.[0]) {
            setSelectedVoice(data[0].voice_id);
          }
        } catch { /* ignore */ }
      })();
    }
  }, [step, voices.length, selectedPreset?.voice_id]);

  const verticals = presets
    ? [...new Set(presets.map((p) => p.vertical_key))].sort()
    : [];

  const visiblePresets = presets
    ? activeVerticalTab === "all"
      ? presets
      : presets.filter((p) => p.vertical_key === activeVerticalTab)
    : [];

  const createAgent = useCallback(async () => {
    if (!selectedPreset || !businessName.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const persona = {
        ...selectedPreset.persona,
        business_name: businessName.trim(),
        direction: selectedPreset.direction,
      };
      const res = await api.post<{ agent: { id: string } }>("/v1/agents", {
        name: `${businessName.trim()} - ${selectedPreset.name}`,
        persona,
        voice_id: selectedVoice || selectedPreset.voice_id,
        tools: selectedPreset.tools,
        analysis_config: selectedPreset.analysis_config,
        consent_required: selectedPreset.consent_required,
        languages: selectedPreset.languages,
        timezone,
        provider: "elevenlabs",
      });
      setCreatedAgentId(res.agent.id);
      // The wizard's business name is the org's name, not just agent persona —
      // merchants expect to find it again in Settings.
      updateOrg({ name: businessName.trim() }).catch(() => {});
      await updateOnboardingStep("create_agent", true);
      await updateOnboardingStep("pick_vertical", true);
    } catch (e: any) {
      setCreateError(e.message || "Failed to create agent.");
      toast.error(e.message || "Failed to create agent.");
    } finally {
      setCreating(false);
    }
  }, [selectedPreset, businessName, selectedVoice, timezone, creating]);

  function next() {
    setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
  }

  function handleSkip() {
    onOpenChange(false);
  }

  function handleFinish() {
    // "Go live" is only true if the merchant actually talked to the agent —
    // skipping the test closes the wizard without marking the step.
    if (!sessionStarted) {
      onOpenChange(false);
      return;
    }
    setFinished(true);
    updateOnboardingStep("test_and_golive", true);
    setTimeout(() => {
      onOpenChange(false);
      onComplete?.();
    }, 1500);
  }

  async function handleSelectPresetAndContinue() {
    if (!selectedPreset) return;
    persistVertical(selectedPreset.vertical_key as VerticalKey);
    next();
  }

  async function handleBusinessContinue() {
    if (!businessName.trim()) return;
    next();
  }

  async function handleVoiceContinue() {
    next();
    if (!createdAgentId) {
      await createAgent();
    }
  }

  // ── Step content ──────────────────────────────────────────────────────────

  const stepContent = (() => {
    if (finished) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <Check className="w-7 h-7 text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">You're all set</p>
            <p className="text-sm text-muted-foreground mt-1">Taking you to your dashboard…</p>
          </div>
        </div>
      );
    }

    if (currentKey === "template") {
      return (
        <div className="flex flex-col gap-5 h-full">
          {/* Pill filter row */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => setActiveVerticalTab("all")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                activeVerticalTab === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
              )}
            >
              All
            </button>
            {verticals.map((v) => (
              <button
                key={v}
                onClick={() => setActiveVerticalTab(v)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border flex items-center gap-1.5",
                  activeVerticalTab === v
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                )}
              >
                {VERTICAL_ICON[v] ?? null}
                <span className="capitalize">{v}</span>
              </button>
            ))}
          </div>

          {/* Preset grid */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {presets === null ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : visiblePresets.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">No templates available.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
                {visiblePresets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPreset(p)}
                    className={cn(
                      "text-left p-5 rounded-xl border transition-all flex flex-col justify-between h-full shadow-sm hover:shadow",
                      selectedPreset?.id === p.id
                        ? "ring-2 ring-foreground border-transparent bg-muted/60"
                        : "border-border bg-background hover:border-foreground/30 hover:bg-muted/30"
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-muted-foreground">
                          {VERTICAL_ICON[p.vertical_key] ?? <Phone className="w-3.5 h-3.5" />}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {p.vertical_key}
                        </span>
                        {selectedPreset?.id === p.id && (
                          <Check className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-snug">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                        {p.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (currentKey === "business") {
      return (
        <div className="flex flex-col justify-center h-full">
          <div className="max-w-sm w-full">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  Business name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && businessName.trim() && handleBusinessContinue()}
                  placeholder="e.g. Acme Store"
                  autoFocus
                  className={cn(
                    "h-12 w-full rounded-xl border border-border bg-background px-4 text-sm",
                    "text-foreground placeholder:text-muted-foreground/50",
                    "focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/40",
                    "transition-colors"
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  Timezone
                </label>
                <input
                  type="text"
                  value={timezone}
                  readOnly
                  className={cn(
                    "h-12 w-full rounded-xl border border-border bg-muted/40 px-4 text-sm",
                    "text-muted-foreground cursor-default"
                  )}
                />
                <p className="text-[11px] text-muted-foreground/70">
                  Detected from your browser. You can change this later in settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentKey === "voice") {
      const activeVoice = voices.find((v) => v.voice_id === selectedVoice);
      return (
        <div className="flex flex-col gap-4 h-full">
          {/* Voice list */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {voices.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2">
                {voices.map((v) => (
                  <button
                    key={v.voice_id}
                    onClick={() => setSelectedVoice(v.voice_id)}
                    className={cn(
                      "text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3",
                      selectedVoice === v.voice_id
                        ? "ring-2 ring-foreground border-transparent bg-muted/60"
                        : "border-border bg-background hover:border-foreground/30 hover:bg-muted/30"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Mic className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{v.name}</p>
                      {v.labels && (
                        <p className="text-[11px] text-muted-foreground capitalize">
                          {[v.labels.gender, v.labels.accent].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    {selectedVoice === v.voice_id && (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (currentKey === "test") {
      if (creating) {
        return (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Setting up your agent…</p>
          </div>
        );
      }
      if (!createdAgentId) {
        if (createError) {
          return (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
              <div className="text-center max-w-sm">
                <p className="text-sm font-semibold text-foreground">We couldn't set up your agent</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{createError}</p>
              </div>
              <Button size="sm" onClick={() => createAgent()}>
                Try again
              </Button>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Initializing…</p>
          </div>
        );
      }
      return (
        <ConversationPanel
          agentId={createdAgentId}
          agentName={selectedPreset?.name ?? "Agent"}
          onSessionStart={() => setSessionStarted(true)}
        />
      );
    }

    return null;
  })();

  // ── Footer actions ────────────────────────────────────────────────────────

  const footerActions = (() => {
    if (finished) return null;

    const backBtn = step > 0 ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setStep((s) => s - 1)}
        className="text-muted-foreground"
      >
        Back
      </Button>
    ) : (
      <button
        onClick={handleSkip}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Skip for now
      </button>
    );

    let primaryBtn: ReactNode = null;

    if (currentKey === "template") {
      primaryBtn = (
        <Button
          disabled={!selectedPreset}
          onClick={handleSelectPresetAndContinue}
          size="sm"
        >
          Continue
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      );
    } else if (currentKey === "business") {
      primaryBtn = (
        <Button
          disabled={!businessName.trim()}
          onClick={handleBusinessContinue}
          size="sm"
        >
          Continue
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      );
    } else if (currentKey === "voice") {
      primaryBtn = (
        <Button
          disabled={!selectedVoice}
          onClick={handleVoiceContinue}
          size="sm"
        >
          {creating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Creating…
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </>
          )}
        </Button>
      );
    } else if (currentKey === "test") {
      primaryBtn = (
        <Button onClick={handleFinish} size="sm">
          {sessionStarted ? "Finish setup" : "Skip test"}
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      );
    }

    return (
      <div className="flex items-center justify-between pt-5 border-t border-border shrink-0">
        {backBtn}
        {primaryBtn}
      </div>
    );
  })();

  // ── Left step rail ────────────────────────────────────────────────────────

  const stepRail = (
    <div className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border bg-muted/20 px-5 py-6">
      <div className="mb-8">
        <WeeberLogo className="h-5 w-auto" />
      </div>

      <div className="flex flex-col gap-1 flex-1">
        {STEP_KEYS.map((key, i) => {
          const isDone = i < step;
          const isActive = i === step;

          return (
            <div key={key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold transition-colors",
                    isDone
                      ? "bg-emerald-500 text-white"
                      : isActive
                      ? "bg-foreground text-background"
                      : "bg-muted border border-border text-muted-foreground"
                  )}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < STEP_KEYS.length - 1 && (
                  <div
                    className={cn(
                      "w-px flex-1 my-1 min-h-[24px]",
                      isDone ? "bg-emerald-500/40" : "bg-border"
                    )}
                  />
                )}
              </div>

              <div className="pb-6">
                <p
                  className={cn(
                    "text-sm font-medium leading-6 transition-colors",
                    isActive ? "text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/60"
                  )}
                >
                  {STEP_LABELS[key]}
                </p>
                {isActive && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed -mt-0.5">
                    {STEP_SUBTITLES[key]}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSkip}
        className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-auto"
      >
        Skip for now
      </button>
    </div>
  );

  // ── Progress bar (shown when rail is hidden) ─────────────────────────────

  const progressBar = (
    <div className="lg:hidden flex gap-1.5 px-5 pt-4 pb-3 shrink-0">
      {STEP_KEYS.map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 h-1 rounded-full transition-colors",
            i < step
              ? "bg-emerald-500"
              : i === step
              ? "bg-foreground"
              : "bg-muted"
          )}
        />
      ))}
    </div>
  );

  // ── Right content panel ───────────────────────────────────────────────────

  const contentPanel = (
    <div className="flex flex-col flex-1 overflow-hidden px-5 py-5 sm:px-8 sm:py-6">
      {!finished && (
        <div className="mb-5 shrink-0">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">
            Step {step + 1} of {STEP_KEYS.length}
          </p>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground leading-tight">
            {STEP_TITLES[currentKey]}
          </h2>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {stepContent}
      </div>

      {footerActions}
    </div>
  );

  // ── Desktop layout ────────────────────────────────────────────────────────

  const desktopLayout = (
    <div className="flex flex-col flex-1 w-full h-full overflow-hidden">
      {progressBar}
      {/* FIX: Explicitly set flex-row, w-full, and h-full so children map side-by-side correctly */}
      <div className="flex flex-1 flex-row w-full h-full overflow-hidden">
        {stepRail}
        {contentPanel}
      </div>
    </div>
  );

  // ── Mobile layout ─────────────────────────────────────────────────────────

  const mobileLayout = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex gap-1.5 px-4 pt-4 pb-3 shrink-0">
        {STEP_KEYS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 h-1 rounded-full transition-colors",
              i < step
                ? "bg-emerald-500"
                : i === step
                ? "bg-foreground"
                : "bg-muted"
            )}
          />
        ))}
      </div>

      {!finished && (
        <div className="px-4 pb-4 shrink-0">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
            {STEP_LABELS[currentKey]}
          </p>
          <h2 className="text-xl font-semibold text-foreground leading-tight">
            {STEP_TITLES[currentKey]}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{STEP_SUBTITLES[currentKey]}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 min-h-0">
        {stepContent}
      </div>

      <div className="px-4 pb-6 pt-2 shrink-0">
        {footerActions}
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[92dvh]">
          {mobileLayout}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[94vw] sm:max-w-5xl h-[85vh] max-h-[780px] p-0 gap-0 flex flex-col overflow-hidden"
        showCloseButton={false}
      >
        {desktopLayout}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Check, Play, ArrowRight, Loader as Loader2, Mic } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WeeberLogo } from "@/components/WeeberLogo";
import { ConversationPanel } from "./ConversationPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { api } from "@/lib/api";
import { listAgentPresets, listVoices, getOrg, updateOnboardingStep } from "@/lib/db";
import { toast } from "sonner";
import type { VerticalKey } from "@/config/verticals";
import { useVertical } from "@/lib/VerticalContext";

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

const STEP_TITLES: Record<StepKey, string> = {
  template: "What kind of business?",
  business: "Tell us about your store",
  voice: "How should it sound?",
  test: "Say hello to your agent",
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
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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
      await updateOnboardingStep("create_agent", true);
      await updateOnboardingStep("pick_vertical", true);
    } catch (e: any) {
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

  const modalContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <WeeberLogo size="sm" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{STEP_TITLES[currentKey]}</h2>
          </div>
        </div>
        {step > 0 && !creating && (
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border shrink-0">
        {STEP_KEYS.map((k, i) => (
          <div key={k} className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                i < step ? "bg-emerald-500" : i === step ? "bg-foreground" : "bg-muted"
              }`}
            />
            {i === step && (
              <span className="text-xs font-medium text-foreground">
                Step {i + 1} of {STEP_KEYS.length}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {finished ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center animate-[scale-in_0.3s_ease-out]">
              <Check className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Your agent is ready</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Let's get it a phone number.
              </p>
            </div>
          </div>
        ) : currentKey === "template" ? (
          <div className="space-y-4">
            {verticals.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-0">
                <button
                  onClick={() => setActiveVerticalTab("all")}
                  className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    activeVerticalTab === "all"
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
                {verticals.map((v) => (
                  <button
                    key={v}
                    onClick={() => setActiveVerticalTab(v)}
                    className={`px-3 py-2 text-xs font-medium whitespace-nowrap capitalize border-b-2 -mb-px transition-colors ${
                      activeVerticalTab === v
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}

            {presets === null ? (
              <div className="text-sm text-muted-foreground animate-pulse">Loading templates...</div>
            ) : visiblePresets.length === 0 ? (
              <div className="text-sm text-muted-foreground">No templates available.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {visiblePresets.map((p) => {
                  const isSelected = selectedPreset?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPreset(p)}
                      className={`text-left p-4 rounded-md border transition-all ${
                        isSelected
                          ? "border-foreground bg-muted/50 ring-1 ring-foreground/20"
                          : "border-border bg-background hover:border-foreground/20"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="font-medium text-sm">{p.name}</div>
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {p.direction}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                        {p.description}
                      </p>
                      {p.vertical_key && (
                        <span className="mt-2 inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                          {p.vertical_key}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : currentKey === "business" ? (
          <div className="space-y-4 max-w-md">
            <p className="text-sm text-muted-foreground">
              This personalizes your agent's greeting and identity.
            </p>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Business name
              </label>
              <input
                autoFocus
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Bloom Dental Clinic"
                className="h-10 px-3 rounded-md border border-border bg-background w-full text-sm focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Timezone
              </label>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="h-10 px-3 rounded-md border border-border bg-background w-full text-sm focus:outline-none focus:border-foreground focus:ring-1 focus:ring-foreground/20"
              />
            </div>
            {selectedPreset && (
              <div className="p-3 rounded-md bg-muted/50 border border-border">
                <div className="text-xs font-medium text-muted-foreground mb-1">Template</div>
                <div className="text-sm font-medium">{selectedPreset.name}</div>
              </div>
            )}
          </div>
        ) : currentKey === "voice" ? (
          <div className="space-y-4">
            {!showVoicePicker ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your agent will use <span className="font-medium text-foreground">{selectedPreset?.voice_name || "the default voice"}</span>.
                </p>
                <div className="flex items-center gap-3 p-4 rounded-md border border-border bg-muted/30">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Mic className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{selectedPreset?.voice_name || "Default"}</div>
                    <div className="text-xs text-muted-foreground">Pre-selected for this template</div>
                  </div>
                  {selectedPreset?.voice_id && voices.find((v) => v.voice_id === selectedPreset.voice_id)?.preview_url && (
                    <button
                      onClick={() => {
                        const voice = voices.find((v) => v.voice_id === selectedPreset.voice_id);
                        if (voice?.preview_url) new Audio(voice.preview_url).play().catch(() => {});
                      }}
                      className="p-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleVoiceContinue} className="flex-1">
                    Keep this voice
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button variant="outline" onClick={() => setShowVoicePicker(true)}>
                    Choose different
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Choose a voice</p>
                  <button
                    onClick={() => setShowVoicePicker(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {voices.map((v) => (
                    <div
                      key={v.voice_id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedVoice(v.voice_id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedVoice(v.voice_id); }}
                      className={`relative text-left p-3 rounded-md border transition-colors cursor-pointer ${
                        selectedVoice === v.voice_id
                          ? "border-foreground bg-muted/50"
                          : "border-border bg-background hover:bg-muted/30"
                      }`}
                    >
                      {selectedVoice === v.voice_id && (
                        <Check className="absolute top-2 right-2 w-3.5 h-3.5" />
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{v.name}</span>
                        {v.preview_url && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              new Audio(v.preview_url!).play().catch(() => {});
                            }}
                            className="p-1 rounded hover:bg-muted"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {v.labels && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {[v.labels.gender, v.labels.accent, v.labels.use_case].filter(Boolean).join(" \u00b7 ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button onClick={handleVoiceContinue} className="w-full" disabled={!selectedVoice}>
                  Use selected voice
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        ) : currentKey === "test" ? (
          <div className="space-y-4">
            {creating ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Creating your agent...</p>
              </div>
            ) : !createdAgentId ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <p className="text-sm text-muted-foreground">Setting up your agent...</p>
                <Button onClick={createAgent} disabled={creating}>
                  Create agent
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Talk to your agent in the browser. Test how it handles a real conversation.
                </p>
                <ConversationPanel
                  agentId={createdAgentId}
                  agentName={businessName || "Your agent"}
                  onSessionStart={() => setSessionStarted(true)}
                />
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      {!finished && (
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between">
          <div>
            {step > 0 && !creating && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentKey === "template" && (
              <Button onClick={handleSelectPresetAndContinue} disabled={!selectedPreset}>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {currentKey === "business" && (
              <Button onClick={handleBusinessContinue} disabled={!businessName.trim()}>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {currentKey === "test" && createdAgentId && !creating && (
              <>
                {!sessionStarted && (
                  <button
                    onClick={handleFinish}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Finish without testing
                  </button>
                )}
                {sessionStarted && (
                  <Button onClick={handleFinish}>
                    <Check className="w-4 h-4 mr-2" />
                    Finish
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[95dvh]">
          {modalContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[70vw] max-w-4xl h-[70vh] min-h-[560px] p-0 gap-0 flex flex-col overflow-hidden"
        showCloseButton={false}
      >
        {modalContent}
      </DialogContent>
    </Dialog>
  );
}

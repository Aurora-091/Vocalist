import { useEffect, useState } from "react";
import { Bot, Phone, PhoneOutgoing, ArrowRight, ArrowLeft } from "lucide-react";
import { listAgentPresets } from "../lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import VoiceLibrary from "../pages/VoiceLibrary";

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
};

export function AgentPresetPicker({
  verticalKey,
  showAllVerticals = false,
  onSelect,
  onSkip,
}: {
  verticalKey?: string;
  showAllVerticals?: boolean;
  onSelect: (preset: Preset & { overrideVoiceId?: string }) => void;
  onSkip: () => void;
}) {
  const [allPresets, setAllPresets] = useState<Preset[] | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [voiceStep, setVoiceStep] = useState(false);
  const [overrideVoiceId, setOverrideVoiceId] = useState<string>("");
  const [overrideVoiceName, setOverrideVoiceName] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        // If showAllVerticals, fetch without vertical filter
        const data = await listAgentPresets(showAllVerticals ? undefined : verticalKey);
        setAllPresets(data);
        // Default to the org's vertical tab if present
        if (showAllVerticals && verticalKey) {
          setActiveTab(verticalKey);
        }
      } catch {
        setAllPresets([]);
      }
    })();
  }, [verticalKey, showAllVerticals]);

  const verticals = allPresets
    ? [...new Set(allPresets.map((p) => p.vertical_key))].sort()
    : [];

  const visiblePresets = allPresets
    ? activeTab === "all"
      ? allPresets
      : allPresets.filter((p) => p.vertical_key === activeTab)
    : [];

  const selectedPreset = allPresets?.find((p) => p.id === selected);

  function handleConfirm() {
    if (!selectedPreset) return;
    setVoiceStep(true);
  }

  function handleFinish(skipVoice: boolean) {
    if (!selectedPreset) return;
    const finalVoiceId = skipVoice
      ? selectedPreset.voice_id || undefined
      : overrideVoiceId || selectedPreset.voice_id || undefined;
    onSelect({ ...selectedPreset, overrideVoiceId: finalVoiceId });
  }

  if (voiceStep && selectedPreset) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setVoiceStep(false)}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="font-medium text-sm">Override voice for "{selectedPreset.name}"</div>
            <p className="text-xs text-text-muted mt-0.5">
              The preset includes{" "}
              <span className="font-medium text-text">{selectedPreset.voice_name || "a default voice"}</span>.
              Choose a different one or skip to keep it.
            </p>
          </div>
          {overrideVoiceName && (
            <span className="ml-auto text-xs text-success font-medium shrink-0">{overrideVoiceName} selected</span>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          <VoiceLibrary
            onSelect={(vid, vname) => { setOverrideVoiceId(vid); setOverrideVoiceName(vname); }}
            selectedVoiceId={overrideVoiceId || selectedPreset.voice_id || undefined}
            filterLanguages={selectedPreset.languages}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => handleFinish(true)}>
            Keep preset voice
          </Button>
          <Button onClick={() => handleFinish(false)} disabled={!overrideVoiceId}>
            Use selected voice
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Choose a template</div>
          <p className="text-sm text-text-muted mt-0.5">
            Pre-built agent personas with tools and voice configured.
            {!showAllVerticals && verticalKey && (
              <span className="ml-1">
                Showing <span className="capitalize font-medium text-text">{verticalKey}</span> templates.
              </span>
            )}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Start from scratch
        </Button>
      </div>

      {/* Vertical tabs — only shown when browsing all verticals */}
      {showAllVerticals && verticals.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-0">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeTab === "all"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {verticals.map((v) => (
            <button
              key={v}
              onClick={() => setActiveTab(v)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap capitalize border-b-2 -mb-px transition-colors ${
                activeTab === v
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {allPresets === null ? (
        <div className="grid md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : visiblePresets.length === 0 ? (
        <div className="text-center py-8 text-sm text-text-muted">
          No templates available{activeTab !== "all" ? ` for ${activeTab}` : ""}.
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            {visiblePresets.map((p) => {
              const isSelected = selected === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`text-left p-4 rounded-md border transition-all ${
                    isSelected
                      ? "border-primary bg-primary/[0.03] ring-1 ring-primary/20"
                      : "border-border bg-surface hover:border-text/20"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <Bot className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="font-medium text-sm">{p.name}</div>
                        {showAllVerticals && (
                          <div className="text-[10px] text-muted-foreground capitalize mt-0.5">{p.vertical_key}</div>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={p.direction === "inbound" ? "bg-info/15 text-info" : p.direction === "outbound" ? "bg-warning/15 text-warning" : "bg-muted text-foreground"}
                    >
                      {p.direction === "inbound" && <Phone className="w-3 h-3 mr-1" />}
                      {p.direction === "outbound" && <PhoneOutgoing className="w-3 h-3 mr-1" />}
                      {p.direction}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-text-muted leading-relaxed line-clamp-2">
                    {p.description}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {p.voice_name && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-text-muted">
                        Voice: {p.voice_name}
                      </span>
                    )}
                    {p.consent_required && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success">
                        Consent enforced
                      </span>
                    )}
                    {p.tools.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-text-muted">
                        {p.tools.length} tool{p.tools.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onSkip}>
              Skip
            </Button>
            <Button onClick={handleConfirm} disabled={!selected}>
              Use template
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

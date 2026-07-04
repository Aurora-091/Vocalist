import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight, ArrowLeft, Phone, Loader as Loader2, Play } from "lucide-react";
import { api } from "../lib/api";
import { listAgentPresets, listVoices } from "../lib/db";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { VerticalProvider, useVertical } from "../lib/VerticalContext";
import type { VerticalKey } from "../config/verticals";

type Preset = {
  id: string;
  preset_key: string;
  name: string;
  description: string;
  direction: string;
  persona: any;
  tools: any[];
  voice_id: string;
  voice_name: string;
  languages: string[];
  consent_required: boolean;
  analysis_config: any;
};

type Voice = {
  voice_id: string;
  name: string;
  labels?: { accent?: string; gender?: string; use_case?: string };
  preview_url?: string;
};

const STEPS = [
  "vertical",
  "preset",
  "business",
  "voice",
  "tools",
  "test_call",
  "go_live",
] as const;
type StepKey = (typeof STEPS)[number];

const STEP_LABELS: Record<StepKey, string> = {
  vertical: "Your industry",
  preset: "Choose a template",
  business: "Business details",
  voice: "Pick a voice",
  tools: "Connect tools",
  test_call: "Test your agent",
  go_live: "Go live",
};

const VERTICALS = [
  { key: "shopify", label: "E-commerce (Shopify)", desc: "Cart recovery, order status, promos, returns." },
  { key: "clinic", label: "Healthcare / Clinic", desc: "Appointments, reminders, intake, follow-ups." },
] as const;

export default function Onboarding() {
  return (
    <VerticalProvider>
      <OnboardingInner />
    </VerticalProvider>
  );
}

function OnboardingInner() {
  const navigate = useNavigate();
  const { setVertical: persistVertical } = useVertical();
  const [step, setStep] = useState(0);
  const [vertical, setVertical] = useState<string | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callPlaced, setCallPlaced] = useState(false);

  const currentKey = STEPS[step];

  useEffect(() => {
    if (vertical) {
      (async () => {
        try {
          const data = await listAgentPresets(vertical);
          setPresets(data);
        } catch {
          setPresets([]);
        }
      })();
    }
  }, [vertical]);

  useEffect(() => {
    if (step === 3) {
      (async () => {
        try {
          const data = await listVoices({ limit: 50 });
          setVoices(data || []);
          if (data && data.length > 0 && !selectedVoice) {
            const defaultVoice = data.find((v: Voice) => v.voice_id === selectedPreset?.voice_id) || data[0];
            setSelectedVoice(defaultVoice.voice_id);
          }
        } catch {}
      })();
    }
  }, [step]);

  async function createAgentFromPreset() {
    if (!selectedPreset || !businessName.trim()) return;
    setBusy(true);
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
      toast.success("Agent created from template.");
    } catch (e: any) {
      toast.error(e.message || "Failed to create agent.");
    } finally {
      setBusy(false);
    }
  }

  async function placeTestCall() {
    if (!createdAgentId || !testNumber.trim()) return;
    setCalling(true);
    try {
      await api.post(`/v1/agents/${createdAgentId}/test-call`, { to_number: testNumber.trim() });
      toast.success("Call initiated — your phone should ring shortly.");
      setCallPlaced(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to place test call.");
    } finally {
      setCalling(false);
    }
  }

  function next() { setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  return (
    <div className="min-h-full bg-bg p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
          {/* Progress bar */}
          <div className="px-8 pt-8 pb-4 border-b border-border">
            <div className="flex items-center gap-1.5 mb-3">
              {STEPS.map((k, i) => (
                <span
                  key={k}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < step ? "bg-green-500" : i === step ? "bg-text" : "bg-surface-2"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-text-muted">
                Step {step + 1} of {STEPS.length}
                <span className="ml-2 font-medium text-text">{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
              </div>
              <button onClick={() => navigate("/dashboard")} className="text-xs text-text-muted hover:text-text">
                Skip onboarding
              </button>
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">{STEP_LABELS[currentKey]}</h1>
          </div>

          {/* Step content */}
          <div className="p-8">
            {currentKey === "vertical" && (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  We'll show agent templates built for your industry. You can always add more later.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {VERTICALS.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => { setVertical(v.key); persistVertical(v.key as VerticalKey); next(); }}
                      className={`text-left p-5 rounded-md border transition-colors ${
                        vertical === v.key ? "border-text bg-surface-2" : "border-border bg-surface hover:bg-surface-2"
                      }`}
                    >
                      <div className="font-medium">{v.label}</div>
                      <p className="mt-2 text-sm text-text-muted">{v.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentKey === "preset" && (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  Pick a template. It comes with a ready-to-use prompt, tools, and analysis config. You can customize later.
                </p>
                {presets.length === 0 ? (
                  <div className="text-sm text-text-muted">Loading templates...</div>
                ) : (
                  <div className="grid gap-3">
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPreset(p)}
                        className={`text-left p-4 rounded-md border transition-colors ${
                          selectedPreset?.id === p.id ? "border-text bg-surface-2" : "border-border bg-surface hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{p.name}</div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 text-text-muted">
                            {p.direction}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-text-muted">{p.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentKey === "business" && (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  Tell us about your business. This personalizes the agent's opening message and identity.
                </p>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Business name</label>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Bloom Dental Clinic"
                    className="h-10 px-3 rounded-md border border-border bg-surface w-full max-w-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Timezone</label>
                  <input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="h-10 px-3 rounded-md border border-border bg-surface w-full max-w-md text-sm"
                  />
                </div>
                {selectedPreset && (
                  <div className="p-3 rounded-md bg-surface-2 border border-border">
                    <div className="text-xs font-medium text-text-muted mb-1">Template selected</div>
                    <div className="text-sm font-medium">{selectedPreset.name}</div>
                    <div className="text-xs text-text-muted mt-0.5">{selectedPreset.description}</div>
                  </div>
                )}
              </div>
            )}

            {currentKey === "voice" && (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  Choose how your agent sounds. Default: {selectedPreset?.voice_name || "Rachel"}.
                </p>
                <div className="grid sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                  {voices.length === 0 ? (
                    <div className="text-xs text-text-muted">Loading voices...</div>
                  ) : (
                    voices.map((v) => (
                      <div
                        key={v.voice_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedVoice(v.voice_id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedVoice(v.voice_id); }}
                        className={`relative text-left p-3 rounded-md border transition-colors cursor-pointer ${
                          selectedVoice === v.voice_id
                            ? "border-text bg-surface-2"
                            : "border-border bg-surface hover:bg-surface-2"
                        }`}
                      >
                        {selectedVoice === v.voice_id && (
                          <Check className="absolute top-2 right-2 w-3.5 h-3.5 text-text" />
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{v.name}</span>
                          {v.preview_url && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                new Audio(v.preview_url!).play().catch(() => {});
                              }}
                              className="p-1 rounded hover:bg-surface"
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {v.labels && (
                          <div className="mt-1 text-xs text-text-muted">
                            {[v.labels.gender, v.labels.accent, v.labels.use_case].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {currentKey === "tools" && (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  Connect integrations so your agent can access real data. You can skip and connect later from Settings.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { name: "Shopify", note: "Orders, carts, and fulfillments", vertical: "shopify" },
                    { name: "WhatsApp", note: "Follow-up messages", vertical: "shopify" },
                    { name: "Google Calendar", note: "Availability & bookings", vertical: "clinic" },
                    { name: "Cal.com", note: "Scheduling automation", vertical: "clinic" },
                  ]
                    .filter((t) => !vertical || t.vertical === vertical)
                    .map((t) => (
                      <div key={t.name} className="border border-border rounded-md p-4 bg-surface flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{t.name}</div>
                          <div className="text-xs text-text-muted">{t.note}</div>
                        </div>
                        <Button size="sm" variant="secondary" disabled>
                          Connect
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {currentKey === "test_call" && (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  Hear your agent live. Enter your phone number and we'll call you.
                </p>
                {!createdAgentId ? (
                  <div className="space-y-3">
                    <p className="text-sm">Creating your agent from the selected template...</p>
                    <Button onClick={createAgentFromPreset} disabled={busy || !businessName.trim() || !selectedPreset}>
                      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      {busy ? "Creating..." : "Create agent"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      Agent created successfully.
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <input
                        value={testNumber}
                        onChange={(e) => setTestNumber(e.target.value)}
                        placeholder="+1 415 555 0199"
                        className="h-10 px-3 rounded-md border border-border bg-surface flex-1 min-w-[240px] font-mono text-sm"
                      />
                      <Button onClick={placeTestCall} disabled={calling || !testNumber.trim()}>
                        {calling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Phone className="w-4 h-4 mr-2" />}
                        {calling ? "Calling..." : "Test call"}
                      </Button>
                    </div>
                    {callPlaced && (
                      <p className="text-xs text-text-muted">
                        Your phone should ring shortly. Check the Calls page for the transcript afterward.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentKey === "go_live" && (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  You're all set. Your agent is provisioned and ready. Assign a phone number from Settings to start receiving live calls, or launch a campaign for outbound.
                </p>
                <div className="flex gap-3">
                  <Button onClick={() => navigate("/dashboard")}>
                    <Check className="w-4 h-4 mr-2" />
                    Go to dashboard
                  </Button>
                  {createdAgentId && (
                    <Button variant="secondary" onClick={() => navigate(`/agents/${createdAgentId}`)}>
                      View agent
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation footer */}
          <div className="px-8 pb-6 flex justify-between">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            {currentKey !== "vertical" && currentKey !== "go_live" && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (currentKey === "test_call" && !createdAgentId) {
                    createAgentFromPreset().then(() => next());
                  } else {
                    next();
                  }
                }}
                disabled={
                  (currentKey === "preset" && !selectedPreset) ||
                  (currentKey === "business" && !businessName.trim())
                }
              >
                {currentKey === "test_call" ? "Skip test" : "Next"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

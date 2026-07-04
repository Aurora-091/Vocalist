import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Save, Loader as Loader2, ChevronDown, Check, Phone, X, Mic, RefreshCw, ChevronRight, TriangleAlert as AlertTriangle, Copy, Zap } from "lucide-react";
import { toast } from "sonner";
import { getAgent, listVoices, listAgentKnowledge, getCall } from "../lib/db";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { Button } from "../components/legacy-ui/Button";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { Badge } from "../components/legacy-ui/Badge";
import { Skeleton } from "../components/legacy-ui/States";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import VoiceLibrary from "./VoiceLibrary";

const TONE_PRESETS = [
  "warm and professional",
  "calm and reassuring",
  "energetic and friendly",
  "formal and precise",
  "empathetic and supportive",
  "concise and direct",
  "custom",
] as const;

const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "ko", label: "Korean" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "bn", label: "Bengali" },
  { code: "bg", label: "Bulgarian" },
  { code: "hr", label: "Croatian" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
  { code: "el", label: "Greek" },
  { code: "id", label: "Indonesian" },
  { code: "ms", label: "Malay" },
  { code: "no", label: "Norwegian" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sk", label: "Slovak" },
  { code: "sv", label: "Swedish" },
  { code: "ta", label: "Tamil" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "vi", label: "Vietnamese" },
];

type Agent = {
  id: string;
  name: string;
  vertical: string | null;
  provider: string;
  consent_required: boolean;
  persona: any;
  languages: string[] | null;
  timezone: string | null;
  transfer_number: string | null;
  business_hours: any;
  provider_ref?: string | null;
  provider_agent_id?: string | null;
  voice_id?: string | null;
  conversation_config_id?: string | null;
  sync_status?: string | null;
  sync_error?: string | null;
};

export default function AgentDetail() {
  const { id } = useParams();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [voiceName, setVoiceName] = useState<string>("");
  const [voiceDrawerOpen, setVoiceDrawerOpen] = useState(false);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [langVoiceWarning, setLangVoiceWarning] = useState<string[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [toneMode, setToneMode] = useState<string>(TONE_PRESETS[0]);
  const [customTone, setCustomTone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [guardrails, setGuardrails] = useState("");
  const [identity, setIdentity] = useState("");
  const [transferNumber, setTransferNumber] = useState("");
  const [timezone, setTimezone] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["en"]);

  // Test call
  const [testNumber, setTestNumber] = useState("");
  const [calling, setCalling] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  // Skills
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [activeSkillIds, setActiveSkillIds] = useState<Set<string>>(new Set());
  const [skillsLoading, setSkillsLoading] = useState(false);

  async function load() {
    try {
      const a = await getAgent(id!);
      setAgent(a);
      setName(a.name || "");
      setObjective(a.persona?.objective || "");

      const savedTone = a.persona?.tone || "";
      const isPreset = (TONE_PRESETS as readonly string[]).includes(savedTone);
      if (!savedTone || isPreset) {
        setToneMode(savedTone || TONE_PRESETS[0]);
        setCustomTone("");
      } else {
        setToneMode("custom");
        setCustomTone(savedTone);
      }

      setBusinessName(a.persona?.business_name || "");
      setFirstMessage(a.persona?.first_message || a.persona?.opening_message || "");
      setGuardrails(
        Array.isArray(a.persona?.guardrails)
          ? (a.persona.guardrails as string[]).join("\n")
          : a.persona?.guardrails || ""
      );
      setIdentity(a.persona?.identity || "");
      setTransferNumber(a.transfer_number || "");
      setTimezone(a.timezone || "America/New_York");
      const langs = (a.languages || ["en"])
        .map((l: string) => l.trim().toLowerCase().slice(0, 5))
        .filter(Boolean);
      setSelectedLanguages(langs.length ? langs : ["en"]);

      // Resolve voice name
      if (a.voice_id) {
        const voices = await listVoices();
        const match = voices.find((v: any) => v.voice_id === a.voice_id);
        setVoiceName(match?.name || a.voice_id);

        // Language-voice compatibility check
        const voiceLangs: string[] = match?.language_codes || ["en"];
        const unsupported = langs.filter((l: string) => !voiceLangs.includes(l));
        setLangVoiceWarning(unsupported);
      } else {
        setVoiceName("Default (Rachel)");
        setLangVoiceWarning([]);
      }

      const kb = await listAgentKnowledge(id!);
      setKnowledge(kb);

      // Load skills catalog and active skills for this agent
      const [skillsRes, activeRes] = await Promise.all([
        api.get<{ skills: any[] }>("/v1/skills"),
        api.get<{ skills: any[] }>(`/v1/agents/${id}/skills`),
      ]);
      setAllSkills(skillsRes.skills || []);
      const ids = new Set((activeRes.skills || []).map((s: any) => s.skill_id));
      setActiveSkillIds(ids);
    } catch {
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  // Re-check language-voice compatibility when languages change
  useEffect(() => {
    if (!agent?.voice_id) return;
    (async () => {
      const voices = await listVoices();
      const match = voices.find((v: any) => v.voice_id === agent.voice_id);
      const voiceLangs: string[] = match?.language_codes || ["en"];
      const unsupported = selectedLanguages.filter((l) => !voiceLangs.includes(l));
      setLangVoiceWarning(unsupported);
    })();
  }, [selectedLanguages]);

  async function save() {
    if (!agent) return;
    setSaving(true);
    try {
      const effectiveTone = toneMode === "custom" ? customTone : toneMode;
      const guardrailsValue = guardrails.trim()
        ? guardrails.split("\n").map((s) => s.trim()).filter(Boolean)
        : [];
      const persona = {
        ...(agent.persona || {}),
        objective,
        tone: effectiveTone,
        business_name: businessName,
        first_message: firstMessage || undefined,
        opening_message: firstMessage || undefined,
        guardrails: guardrailsValue.length ? guardrailsValue : undefined,
        identity: identity.trim() || undefined,
      };
      await api.patch(`/v1/agents/${id}`, {
        name,
        persona,
        transfer_number: transferNumber.trim() || undefined,
        timezone: timezone || "America/New_York",
        languages: selectedLanguages,
      });
      toast.success("Agent saved and synced.");
      load();
    } catch (e: any) {
      const detail = e.details || e.detail;
      if (detail && typeof detail === "object") {
        const msg = Array.isArray(detail)
          ? detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join("; ")
          : detail.detail || detail.message || JSON.stringify(detail);
        toast.error(`Provider error: ${msg}`);
      } else {
        toast.error(e.message || "Couldn't save.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleVoiceSelect(voiceId: string, name: string) {
    setVoiceDrawerOpen(false);
    try {
      await api.patch(`/v1/agents/${id}`, { voice_id: voiceId });
      toast.success(`Voice changed to ${name}.`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to change voice.");
    }
  }

  async function retrySync() {
    if (!agent) return;
    setSyncing(true);
    try {
      await api.post(`/v1/agents/${id}/sync`, {});
      toast.success("Agent re-synced with ElevenLabs.");
      load();
    } catch (e: any) {
      toast.error(e.message || "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function loadPromptPreview() {
    setPromptLoading(true);
    try {
      const res = await api.get<{ system_prompt: string }>(`/v1/agents/${id}/system-prompt`);
      setPromptPreview(res.system_prompt);
    } catch {
      setPromptPreview("Could not load preview.");
    } finally {
      setPromptLoading(false);
    }
  }

  if (loading) return <Skeleton className="h-64" />;
  if (!agent) return <div className="text-sm text-text-muted">Agent not found.</div>;

  const direction = agent.persona?.direction || "inbound";

  return (
    <div className="space-y-6">
      <div>
        <Link to="/agents" className="inline-flex items-center text-sm text-text-muted hover:text-text">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to agents
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
            <p className="text-sm text-text-muted mt-1">{direction} · {agent.provider}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {agent.sync_status === "synced" && <Badge tone="success">Synced</Badge>}
            {agent.sync_status === "pending" && <Badge tone="warning">Pending</Badge>}
            {agent.sync_status === "failed" && <Badge tone="danger">Sync failed</Badge>}
            {agent.consent_required && <Badge tone="success" dot>consent locked on</Badge>}
          </div>
        </div>
      </div>

      {/* Sync failure banner */}
      {agent.sync_status === "failed" && (
        <div className="flex items-start gap-3 p-4 rounded-md bg-danger/10 border border-danger/20">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-danger">Provider sync failed</div>
            {agent.sync_error && (
              <div className="text-xs text-text-muted mt-1 break-words">{agent.sync_error}</div>
            )}
          </div>
          <Button variant="secondary" onClick={retrySync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Retrying…" : "Retry sync"}
          </Button>
        </div>
      )}

      {/* Persona card */}
      <Card>
        <CardHeader>
          <div className="font-medium">Persona</div>
        </CardHeader>
        <CardBody>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Display name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Business name">
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Lakeshore Family Clinic"
              />
            </Field>
            <Field label="Objective" full>
              <Textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                rows={3}
                placeholder="Answer questions and book appointments. Route billing questions to a human."
              />
            </Field>
            <Field label="Opening message (first_message)">
              <Input
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                placeholder="Hello, thanks for calling. How can I help?"
              />
            </Field>
            <Field label="Tone">
              <Select value={toneMode} onValueChange={setToneMode}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TONE_PRESETS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "custom" ? "Custom…" : t.charAt(0).toUpperCase() + t.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {toneMode === "custom" && (
              <Field label="Custom tone">
                <Input
                  value={customTone}
                  onChange={(e) => setCustomTone(e.target.value)}
                  placeholder="Playful yet authoritative, like a knowledgeable friend"
                />
              </Field>
            )}
            <Field label="Guardrails (one per line)" full>
              <Textarea
                value={guardrails}
                onChange={(e) => setGuardrails(e.target.value)}
                rows={3}
                placeholder={"Do not discuss pricing unless asked.\nAlways offer to transfer to a human for complex issues."}
                className="font-mono"
              />
            </Field>
            <Field label="Identity (optional)">
              <Input
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="You are Maya, a billing assistant at Acme Corp."
              />
            </Field>
            <Field label="Timezone">
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </Field>
            <Field label="Languages">
              <LanguagePicker selected={selectedLanguages} onChange={setSelectedLanguages} />
            </Field>
            <Field label="Human transfer number">
              <Input
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                placeholder="+14155551234"
                className="font-mono"
              />
            </Field>
          </div>

          {langVoiceWarning.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-xs text-warning">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Voice may not support:{" "}
              {langVoiceWarning
                .map((c) => LANGUAGE_OPTIONS.find((l) => l.code === c)?.label ?? c)
                .join(", ")}
            </div>
          )}

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <button
              type="button"
              className="text-sm text-text-muted hover:text-text flex items-center gap-1"
              onClick={async () => {
                if (!promptOpen && !promptPreview) await loadPromptPreview();
                setPromptOpen((v) => !v);
              }}
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${promptOpen ? "rotate-90" : ""}`} />
              Preview compiled prompt
            </button>
          </div>

          {promptOpen && (
            <div className="mt-4 p-3 rounded-md bg-surface-2 border border-border">
              {promptLoading ? (
                <Skeleton className="h-32" />
              ) : (
                <pre className="text-xs text-text-muted whitespace-pre-wrap font-mono leading-relaxed">
                  {promptPreview}
                </pre>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Deployment card */}
      <Card>
        <CardHeader>
          <div className="font-medium">Deployment (ElevenLabs CAI)</div>
        </CardHeader>
        <CardBody>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <Field label="Provider Agent ID">
              <div className="h-10 px-3 rounded-md border border-border bg-surface-2 flex items-center font-mono text-xs">
                {agent.provider_ref || agent.provider_agent_id || "Not provisioned"}
              </div>
            </Field>
            <Field label="Voice">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-10 px-3 rounded-md border border-border bg-surface-2 flex items-center font-mono text-xs truncate">
                  {voiceName}
                </div>
                <Button variant="secondary" onClick={() => setVoiceDrawerOpen(true)}>
                  <Mic className="w-4 h-4 mr-1.5" />
                  Change
                </Button>
              </div>
            </Field>
            <Field label="Conversation Config ID">
              <div className="h-10 px-3 rounded-md border border-border bg-surface-2 flex items-center font-mono text-xs">
                {agent.conversation_config_id || "None"}
              </div>
            </Field>
            <Field label="Sync Status">
              <div className="h-10 px-3 rounded-md border border-border bg-surface-2 flex items-center gap-2">
                {agent.sync_status === "synced" && <Badge tone="success">Synced</Badge>}
                {agent.sync_status === "pending" && <Badge tone="warning">Pending</Badge>}
                {agent.sync_status === "failed" && <Badge tone="danger">Failed</Badge>}
                {!agent.sync_status && <Badge tone="neutral">Not synced</Badge>}
              </div>
            </Field>
            <Field label="Linked Knowledge" full>
              <div className="border border-border rounded-md divide-y divide-border bg-surface-2">
                {knowledge.length === 0 ? (
                  <div className="p-3 text-xs text-text-muted">
                    No knowledge sources linked. Attach sources from the Integrations page.
                  </div>
                ) : (
                  knowledge.map((k: any) => (
                    <div key={k.source_id || k.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-medium">{k.knowledge_sources?.title || "Source"}</div>
                        <div className="text-text-muted capitalize">{k.knowledge_sources?.kind}</div>
                      </div>
                      <Badge tone={k.knowledge_sources?.status === "ready" ? "success" : "warning"}>
                        {k.knowledge_sources?.status || "pending"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Skills card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 font-medium">
            <Zap className="w-4 h-4" />
            Skills
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-text-muted mb-4">
            Toggle capabilities for this agent. Changes sync to the provider on next save.
          </p>
          {allSkills.length === 0 ? (
            <div className="text-xs text-text-muted">No skills available.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {allSkills.map((skill: any) => {
                const isActive = activeSkillIds.has(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    disabled={skillsLoading}
                    onClick={async () => {
                      setSkillsLoading(true);
                      try {
                        await api.post(`/v1/agents/${id}/skills/${skill.id}/toggle`, { enabled: !isActive });
                        setActiveSkillIds((prev) => {
                          const next = new Set(prev);
                          if (isActive) next.delete(skill.id);
                          else next.add(skill.id);
                          return next;
                        });
                      } catch (e: any) {
                        toast.error(e.message || "Failed to toggle skill.");
                      } finally {
                        setSkillsLoading(false);
                      }
                    }}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      isActive
                        ? "border-text/20 bg-text/5"
                        : "border-border bg-surface hover:bg-surface-2"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{skill.name}</span>
                      <div className={`w-8 h-4.5 rounded-full transition-colors flex items-center px-0.5 ${
                        isActive ? "bg-green-500 justify-end" : "bg-border justify-start"
                      }`}>
                        <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                      </div>
                    </div>
                    <div className="text-xs text-text-muted line-clamp-2">{skill.description}</div>
                    <Badge tone="neutral" className="mt-2 text-[10px]">{skill.category}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Test call card */}
      <Card>
        <CardHeader>
          <div className="font-medium">Place a test call</div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-text-muted mb-4">
            Weeber will call the number below so you can hear your agent live.
            Requires ElevenLabs provider to be configured.
          </p>
          <div className="flex flex-wrap gap-3">
            <Input
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              disabled={!agent.provider_ref || calling}
              placeholder="+1 415 555 0199"
              aria-label="Test call phone number"
              className="flex-1 min-w-[240px] font-mono"
            />
            <Button
              disabled={!agent.provider_ref || !testNumber.trim() || calling}
              onClick={async () => {
                setCalling(true);
                setActiveCallId(null);
                try {
                  const res = await api.post<any>(`/v1/agents/${id}/test-call`, { to_number: testNumber.trim() });
                  toast.success("Call initiated. Your phone should ring shortly.");
                  if (res?.call?.id) setActiveCallId(res.call.id);
                } catch (e: any) {
                  toast.error(e.message || "Failed to place call.");
                } finally {
                  setCalling(false);
                }
              }}
            >
              {calling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Phone className="w-4 h-4 mr-2" />}
              {calling ? "Calling..." : "Test call"}
            </Button>
          </div>
          {!agent.provider_ref && (
            <p className="mt-2 text-xs text-text-muted">
              Agent not yet provisioned with ElevenLabs. Save the agent first to trigger provisioning.
            </p>
          )}
        </CardBody>
      </Card>

      {activeCallId && (
        <TestCallDrawer callId={activeCallId} onClose={() => setActiveCallId(null)} />
      )}

      {/* Voice selection overlay */}
      {voiceDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setVoiceDrawerOpen(false)}
          />
          <div className="relative bg-bg border border-border rounded-xl shadow-elevated w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="font-semibold">Choose a voice</div>
              <button
                onClick={() => setVoiceDrawerOpen(false)}
                className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <VoiceLibrary
                onSelect={handleVoiceSelect}
                selectedVoiceId={agent.voice_id || undefined}
                filterLanguages={selectedLanguages}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LanguagePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (langs: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(code: string) {
    if (selected.includes(code)) {
      const next = selected.filter((c) => c !== code);
      onChange(next.length ? next : ["en"]);
    } else {
      onChange([...selected, code]);
    }
  }

  const label = selected.length === 0
    ? "Select languages"
    : selected.map((c) => LANGUAGE_OPTIONS.find((l) => l.code === c)?.label ?? c).join(", ");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm flex items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-surface shadow-elevated overflow-hidden">
          <ul className="max-h-56 overflow-y-auto py-1">
            {LANGUAGE_OPTIONS.map((l) => {
              const isSelected = selected.includes(l.code);
              return (
                <li key={l.code}>
                  <button
                    type="button"
                    onClick={() => toggle(l.code)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-2 transition-colors text-left"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-text border-text" : "border-border"}`}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-surface" />}
                    </span>
                    <span className={isSelected ? "font-medium" : ""}>{l.label}</span>
                    <span className="ml-auto font-mono text-xs text-text-muted">{l.code}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-medium text-text-muted mb-1">{label}</label>
      {children}
    </div>
  );
}

function TestCallDrawer({ callId, onClose }: { callId: string; onClose: () => void }) {
  const [callStatus, setCallStatus] = useState<string>("connecting");
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`call_events_${callId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_events",
          filter: `call_id=eq.${callId}`,
        },
        (payload: any) => {
          const event = payload.new;
          if (event.kind === "transcript") {
            setTranscript((prev) => [
              ...prev,
              { role: event.metadata?.role || "agent", text: event.metadata?.text || "" },
            ]);
          } else if (event.kind === "status_change") {
            setCallStatus(event.metadata?.status || event.metadata?.new_status || "in_progress");
          }
        }
      )
      .subscribe();

    getCall(callId)
      .then((data) => {
        if (data?.status) setCallStatus(data.status);
      })
      .catch(() => {});

    return () => { supabase.removeChannel(channel); };
  }, [callId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const costPerSec = 0.14 / 60;
  const estimatedCost = (elapsed * costPerSec).toFixed(3);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const isEnded = ["completed", "failed", "no_answer", "busy"].includes(callStatus);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 font-medium">
            <Phone className="w-4 h-4" />
            Test call
            <Badge tone={isEnded ? "neutral" : "success"} dot={!isEnded}>
              {callStatus.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-text-muted">
              {minutes}:{seconds.toString().padStart(2, "0")} · ~${estimatedCost}
            </span>
            <button onClick={onClose} className="p-1 rounded hover:bg-surface-2">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div
          ref={scrollRef}
          className="h-48 overflow-y-auto space-y-2 bg-surface-2 rounded-md p-3 border border-border"
        >
          {transcript.length === 0 ? (
            <div className="text-xs text-text-muted flex items-center gap-2">
              {!isEnded && <Loader2 className="w-3 h-3 animate-spin" />}
              {isEnded ? "No transcript received." : "Waiting for conversation to start..."}
            </div>
          ) : (
            transcript.map((t, i) => (
              <div key={i} className={`text-xs ${t.role === "agent" ? "text-text" : "text-text-muted"}`}>
                <span className="font-medium capitalize">{t.role}:</span>{" "}
                {t.text}
              </div>
            ))
          )}
        </div>
      </CardBody>
    </Card>
  );
}

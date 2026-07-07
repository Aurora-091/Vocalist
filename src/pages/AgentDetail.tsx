import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Save, Loader as Loader2, ChevronDown, Check, Phone, X, Mic, RefreshCw, ChevronRight, TriangleAlert as AlertTriangle, Zap, Globe, LayoutTemplate, MessageSquare, WrapText, Clock } from "lucide-react";
import { toast } from "sonner";
import { getAgent, listVoices, listAgentKnowledge, getCall } from "../lib/db";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import VoiceLibrary from "./VoiceLibrary";
import { WebTestCallModal } from "@/components/WebTestCallModal";
import { VariablesPanel } from "@/components/VariablesPanel";
import { AgentPresetPicker } from "@/components/AgentPresetPicker";
import { PromptHistoryDrawer } from "@/components/PromptHistoryDrawer";
import { usePageTitle } from "../hooks/usePageTitle";

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
  const [searchParams] = useSearchParams();
  const fromCallId = searchParams.get("from_call");

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  usePageTitle(agent?.name ? `${agent.name} · Agent` : "Agent");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [voiceName, setVoiceName] = useState<string>("");
  const [voiceDrawerOpen, setVoiceDrawerOpen] = useState(false);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [langVoiceWarning, setLangVoiceWarning] = useState<string[]>([]);

  // Change-template modal
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  // Prompt history drawer
  const [historyOpen, setHistoryOpen] = useState(false);

  // from_call reference panel
  const [fromCall, setFromCall] = useState<any>(null);
  const [fromCallLoading, setFromCallLoading] = useState(false);

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
  const [languageMessages, setLanguageMessages] = useState<Record<string, string>>({});
  const [boostKeywords, setBoostKeywords] = useState<string[]>([]);
  const [boostInput, setBoostInput] = useState("");
  const [conversationStyle, setConversationStyle] = useState<"quick" | "balanced" | "patient">("balanced");
  const [recordVoice, setRecordVoice] = useState(true);
  const [zeroRetentionMode, setZeroRetentionMode] = useState(false);
  const [showLanguageOverrides, setShowLanguageOverrides] = useState(false);

  // Textarea refs for variable insertion
  const objectiveRef = useRef<HTMLTextAreaElement>(null);
  const guardrailsRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusedField = useRef<"objective" | "guardrails" | null>(null);
  const personaCardRef = useRef<HTMLDivElement>(null);

  // Test call
  const [testNumber, setTestNumber] = useState("");
  const [calling, setCalling] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [webTestOpen, setWebTestOpen] = useState(false);
  const [lastWebTestAt, setLastWebTestAt] = useState<string | null>(null);

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
      setLanguageMessages(a.persona?.first_message_overrides || a.persona?.language_messages || {});
      setBoostKeywords(Array.isArray(a.persona?.boost_keywords) ? a.persona.boost_keywords : []);
      setConversationStyle(a.persona?.conversation_style || "balanced");
      const privacyCfg = a.persona?.privacy || a.persona?.privacy_config || {};
      setRecordVoice(
        typeof privacyCfg.store_audio === "boolean"
          ? privacyCfg.store_audio
          : typeof privacyCfg.record_voice === "boolean"
          ? privacyCfg.record_voice
          : true
      );
      setZeroRetentionMode(
        typeof privacyCfg.zero_retention === "boolean"
          ? privacyCfg.zero_retention
          : typeof privacyCfg.zero_retention_mode === "boolean"
          ? privacyCfg.zero_retention_mode
          : false
      );

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

      // Last web test timestamp
      try {
        const { data: testRows } = await supabase
          .from("calls")
          .select("created_at")
          .eq("agent_id", id)
          .eq("direction", "outbound")
          .filter("outcome->test", "eq", "true")
          .order("created_at", { ascending: false })
          .limit(1);
        if (testRows && testRows.length > 0) setLastWebTestAt(testRows[0].created_at);
      } catch {
        // non-fatal
      }
    } catch {
      toast.error("Failed to load agent");
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load the referenced call when from_call param is present
  useEffect(() => {
    if (!fromCallId) return;
    setFromCallLoading(true);
    getCall(fromCallId)
      .then(setFromCall)
      .catch(() => setFromCall(null))
      .finally(() => setFromCallLoading(false));
  }, [fromCallId]);

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
  }, [selectedLanguages, agent?.voice_id]);

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
        first_message_overrides: Object.keys(languageMessages).length > 0 ? languageMessages : undefined,
        language_messages: Object.keys(languageMessages).length > 0 ? languageMessages : undefined,
        boost_keywords: boostKeywords.length > 0 ? boostKeywords : undefined,
        conversation_style: conversationStyle,
        privacy: { store_audio: recordVoice, zero_retention: zeroRetentionMode },
        privacy_config: { record_voice: recordVoice, zero_retention_mode: zeroRetentionMode },
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

  function handleInsertVariable(snippet: string) {
    const field = lastFocusedField.current;
    const ref = field === "objective" ? objectiveRef : field === "guardrails" ? guardrailsRef : null;

    if (!ref?.current) {
      // Fallback: append to objective
      setObjective((v) => v + (v.endsWith(" ") || v === "" ? "" : " ") + snippet);
      toast.success(`Inserted ${snippet} into Objective`);
      return;
    }

    const el = ref.current;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const next = before + snippet + after;

    if (field === "objective") setObjective(next);
    else setGuardrails(next);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
    toast.success(`Inserted ${snippet}`);
  }

  async function handleApplyTemplate(preset: any, mode: "replace" | "merge") {
    if (!agent) return;
    const p = preset.persona || {};

    if (mode === "replace") {
      setObjective(p.objective || "");
      setGuardrails(
        Array.isArray(p.guardrails) ? p.guardrails.join("\n") : p.guardrails || ""
      );
      setIdentity(p.identity || "");
      setFirstMessage(p.first_message || p.opening_message || "");
      const tone = p.tone || "";
      const isPreset = (TONE_PRESETS as readonly string[]).includes(tone);
      if (!tone || isPreset) {
        setToneMode(tone || TONE_PRESETS[0]);
        setCustomTone("");
      } else {
        setToneMode("custom");
        setCustomTone(tone);
      }
      toast.success(`Prompt replaced with "${preset.name}" template.`);
    } else {
      // Merge: append guardrails, keep existing objective
      const newGuardrails = Array.isArray(p.guardrails)
        ? p.guardrails.join("\n")
        : p.guardrails || "";
      if (newGuardrails) {
        setGuardrails((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed}\n${newGuardrails}` : newGuardrails;
        });
      }
      if (p.identity && !identity) setIdentity(p.identity);
      toast.success(`Rules from "${preset.name}" merged into guardrails.`);
    }

    setTemplateModalOpen(false);
  }

  if (loading) return <Skeleton className="h-64" />;
  if (!agent) return <div className="text-sm text-text-muted">Agent not found.</div>;

  const direction = agent.persona?.direction || "inbound";

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-1.5 text-sm text-text-muted" aria-label="Breadcrumb">
          <Link to="/agents" className="hover:text-text transition-colors">Agents</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-text font-medium truncate max-w-[200px]">{agent.name}</span>
        </nav>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
            <p className="text-sm text-text-muted mt-1">{direction} · {agent.provider}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {agent.sync_status === "synced" && <Badge variant="secondary" className="bg-success/15 text-success">Synced</Badge>}
            {agent.sync_status === "pending" && <Badge variant="secondary" className="bg-warning/15 text-warning">Pending</Badge>}
            {agent.sync_status === "failed" && <Badge variant="secondary" className="bg-danger/15 text-danger">Sync failed</Badge>}
            {agent.consent_required && <Badge variant="secondary" className="bg-success/15 text-success"><span className="size-1.5 rounded-full bg-current mr-1" />consent locked on</Badge>}
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
          <Button variant="outline" onClick={retrySync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Retrying…" : "Retry sync"}
          </Button>
        </div>
      )}

      {/* from_call reference panel */}
      {fromCallId && (
        <Card className="gap-0 overflow-visible py-0 shadow-card border-amber-200 bg-amber-50/30">
          <div className="border-b border-amber-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">Improving from call</span>
              <span className="font-mono text-xs opacity-70">{fromCallId.slice(0, 8)}…</span>
            </div>
            <Link
              to={`/agents/${id}`}
              replace
              className="p-1 rounded text-amber-600 hover:text-amber-800 hover:bg-amber-100 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </Link>
          </div>
          {fromCallLoading ? (
            <div className="px-6 py-4 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : fromCall ? (
            <CardContent className="px-6 py-4 space-y-4">
              <div className="flex items-center gap-4 text-xs text-amber-700 flex-wrap">
                <span className="capitalize font-medium">{fromCall.status?.replace(/_/g, " ")}</span>
                {fromCall.duration_sec != null && <span>{fromCall.duration_sec}s</span>}
                {fromCall.hangup_by && <span>Hung up by <span className="capitalize">{fromCall.hangup_by}</span></span>}
                {fromCall.cost_usd != null && <span>${Number(fromCall.cost_usd).toFixed(3)}</span>}
              </div>

              {/* Transcript */}
              {Array.isArray(fromCall.transcript) && fromCall.transcript.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-amber-600 font-medium mb-2">Transcript</p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-md border border-amber-200 bg-white/60 p-3">
                    {fromCall.transcript.map((t: any, i: number) => {
                      const speaker = t.role || t.speaker || "agent";
                      const isAgent = speaker === "agent" || speaker === "assistant";
                      return (
                        <div key={i} className="text-xs">
                          <span className={`font-medium mr-1.5 ${isAgent ? "text-amber-800" : "text-zinc-500"}`}>
                            {isAgent ? "Agent" : "User"}:
                          </span>
                          <span className="text-zinc-700">{t.text || t.content}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Eval failures */}
              {(() => {
                const evalCriteria = fromCall.outcome?.evaluation_criteria_results || fromCall.outcome?.evaluation_criteria;
                const failures = evalCriteria
                  ? Object.entries(evalCriteria).filter(([, v]: [string, any]) => {
                      const result = typeof v === "object" && v !== null ? v.result : v;
                      return result === "failure";
                    })
                  : [];
                if (failures.length === 0) return null;
                return (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-red-600 font-medium mb-2">Evaluation Failures</p>
                    <div className="space-y-1.5">
                      {failures.map(([key, v]: [string, any]) => (
                        <div key={key} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs">
                          <div className="font-medium text-red-700">{key.replace(/_/g, " ")}</div>
                          {v?.rationale && <div className="text-red-600 mt-0.5">{v.rationale}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Tool call failures */}
              {(() => {
                const toolCalls = fromCall.outcome?.tool_calls || [];
                const failedTools = toolCalls.filter((tc: any) => tc.error || tc.status === "error" || tc.status === "failed");
                if (failedTools.length === 0) return null;
                return (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-red-600 font-medium mb-2">Tool Call Failures</p>
                    <div className="space-y-1.5">
                      {failedTools.map((tc: any, i: number) => (
                        <div key={i} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-mono text-red-700">
                          {tc.name || tc.tool}: {tc.error || "failed"}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          ) : (
            <div className="px-6 py-4 text-sm text-amber-700">Call not found.</div>
          )}
        </Card>
      )}

      {/* Persona card */}
      <div ref={personaCardRef}>
      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div className="font-medium">Persona</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              History
            </button>
            <button
              type="button"
              onClick={() => setTemplateModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              Change template
            </button>
          </div>
        </div>
        <CardContent className="px-6 py-5">
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
                ref={objectiveRef}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                onFocus={() => { lastFocusedField.current = "objective"; }}
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
                ref={guardrailsRef}
                value={guardrails}
                onChange={(e) => setGuardrails(e.target.value)}
                onFocus={() => { lastFocusedField.current = "guardrails"; }}
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
            {selectedLanguages.length > 1 && (
              <Field label="" full>
                <div className="border border-border rounded-lg p-3 bg-surface-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowLanguageOverrides(!showLanguageOverrides)}
                    className="flex items-center justify-between w-full text-xs font-semibold text-text hover:text-primary transition-colors"
                  >
                    <span>Opening message per language (Optional)</span>
                    {showLanguageOverrides ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  
                  {showLanguageOverrides && (
                    <div className="mt-3 space-y-3 pt-3 border-t border-border">
                      {selectedLanguages.slice(1).map((lang) => {
                        const opt = LANGUAGE_OPTIONS.find((l) => l.code === lang);
                        return (
                          <div key={lang} className="space-y-1">
                            <label className="text-[11px] font-medium text-text-muted">
                              {opt?.label ?? lang} ({lang.toUpperCase()})
                            </label>
                            <Input
                              value={languageMessages[lang] ?? ""}
                              onChange={(e) => setLanguageMessages((prev) => ({ ...prev, [lang]: e.target.value }))}
                              placeholder={firstMessage || "Hello!"}
                              className="font-mono text-xs"
                            />
                          </div>
                        );
                      })}
                      <p className="text-[10px] text-text-muted mt-1">
                        Leave blank to use the default opening message.
                      </p>
                    </div>
                  )}
                </div>
              </Field>
            )}
            <Field label="Conversation style">
              <div className="flex gap-1 p-1 bg-surface-2 rounded-md border border-border w-fit">
                {(["quick", "balanced", "patient"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setConversationStyle(style)}
                    className={`px-3 py-1 text-xs rounded transition-colors capitalize ${
                      conversationStyle === style
                        ? "bg-surface text-text font-medium border border-border"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-muted mt-1.5">
                {conversationStyle === "quick" && "Short pauses, eager responses — ideal for transactional calls."}
                {conversationStyle === "balanced" && "Natural pacing — suitable for most use cases."}
                {conversationStyle === "patient" && "Long pauses allowed — ideal for complex or slow-paced conversations."}
              </p>
            </Field>
            <Field label="Boost keywords (ASR)" full>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={boostInput}
                    onChange={(e) => setBoostInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === ",") && boostInput.trim()) {
                        e.preventDefault();
                        const kw = boostInput.trim().replace(/,$/, "");
                        if (kw && !boostKeywords.includes(kw) && boostKeywords.length < 50) {
                          setBoostKeywords((prev) => [...prev, kw]);
                        }
                        setBoostInput("");
                      }
                    }}
                    placeholder="Type a keyword and press Enter"
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const kw = boostInput.trim();
                      if (kw && !boostKeywords.includes(kw) && boostKeywords.length < 50) {
                        setBoostKeywords((prev) => [...prev, kw]);
                        setBoostInput("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {boostKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {boostKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 border border-border text-xs font-mono"
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() => setBoostKeywords((prev) => prev.filter((k) => k !== kw))}
                          className="text-text-muted hover:text-danger transition-colors"
                          aria-label={`Remove ${kw}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-text-muted">Brand or product names the agent should recognize accurately. (Max 50. The shop name is added automatically.)</p>
              </div>
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

          {/* Variables detected in prompt fields */}
          <div className="mt-4">
            <VariablesPanel
              promptText={`${objective}\n${firstMessage}\n${identity}\n${guardrails}`}
              onInsert={handleInsertVariable}
            />
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
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
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
        </CardContent>
      </Card>
      </div>

      {/* Deployment card */}
      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="font-medium">Deployment (ElevenLabs CAI)</div>
        </div>
        <CardContent className="px-6 py-5">
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
                <Button variant="outline" onClick={() => setVoiceDrawerOpen(true)}>
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
                {agent.sync_status === "synced" && <Badge variant="secondary" className="bg-success/15 text-success">Synced</Badge>}
                {agent.sync_status === "pending" && <Badge variant="secondary" className="bg-warning/15 text-warning">Pending</Badge>}
                {agent.sync_status === "failed" && <Badge variant="secondary" className="bg-danger/15 text-danger">Failed</Badge>}
                {!agent.sync_status && <Badge variant="secondary" className="bg-muted text-foreground">Not synced</Badge>}
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
                      <Badge variant="secondary" className={k.knowledge_sources?.status === "ready" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}>
                        {k.knowledge_sources?.status || "pending"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Skills card */}
      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="flex items-center gap-2 font-medium">
            <Zap className="w-4 h-4" />
            Skills
          </div>
        </div>
        <CardContent className="px-6 py-5">
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
                      setActiveSkillIds((prev) => {
                        const next = new Set(prev);
                        if (isActive) next.delete(skill.id);
                        else next.add(skill.id);
                        return next;
                      });
                      try {
                        await api.post(`/v1/agents/${id}/skills/${skill.id}/toggle`, { enabled: !isActive });
                      } catch (e: any) {
                        setActiveSkillIds((prev) => {
                          const next = new Set(prev);
                          if (isActive) next.add(skill.id);
                          else next.delete(skill.id);
                          return next;
                        });
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
                    <Badge variant="secondary" className="mt-2 text-[10px] bg-muted text-foreground">{skill.category}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privacy card (Task 5) */}
      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="font-medium">Privacy &amp; data retention</div>
          <p className="text-xs text-text-muted mt-1">Controls how ElevenLabs handles call recordings and data.</p>
        </div>
        <CardContent className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Record voice</div>
              <p className="text-xs text-text-muted mt-0.5">Store call audio in ElevenLabs for transcript and analytics.</p>
            </div>
            <Switch
              checked={recordVoice}
              onCheckedChange={(v) => setRecordVoice(v)}
              aria-label="Record voice"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Zero retention mode</div>
              <p className="text-xs text-text-muted mt-0.5">ElevenLabs retains no data from this agent's conversations.</p>
            </div>
            <Switch
              checked={zeroRetentionMode}
              onCheckedChange={(v) => setZeroRetentionMode(v)}
              aria-label="Zero retention mode"
            />
          </div>
          {zeroRetentionMode && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-xs text-warning">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Zero retention mode disables transcripts, recordings, and evaluation analysis. Ensure this complies with your legal obligations.</span>
            </div>
          )}
          <div className="pt-2">
            <Button onClick={save} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? "Saving…" : "Save privacy settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test call card */}
      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="font-medium">Test your agent</div>
        </div>
        <CardContent className="px-6 py-5 space-y-4">
          {/* Browser test — primary */}
          <div>
            <p className="text-sm text-text-muted mb-3">
              Talk to your agent directly in the browser. No phone needed.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                disabled={!agent.provider_ref}
                onClick={() => setWebTestOpen(true)}
                className="w-full sm:w-auto"
              >
                <Globe className="w-4 h-4 mr-2" />
                Test in browser
              </Button>
              {lastWebTestAt && (
                <span className="text-xs text-text-muted">
                  Last tested{" "}
                  {new Date(lastWebTestAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Phone test — secondary */}
          <div className="border-t pt-4">
            <p className="text-xs text-text-muted mb-3">
              Or call a phone number to hear your agent on a real line.
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
                variant="outline"
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
                {calling ? "Calling..." : "Call phone"}
              </Button>
            </div>
          </div>

          {!agent.provider_ref && (
            <p className="mt-2 text-xs text-text-muted">
              Agent not yet provisioned with ElevenLabs. Save the agent first to trigger provisioning.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Prompt history drawer */}
      {historyOpen && (
        <PromptHistoryDrawer
          agentId={id!}
          onRestore={load}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* Change Template modal */}
      {templateModalOpen && (
        <ChangeTemplateModal
          agent={agent}
          onApply={handleApplyTemplate}
          onClose={() => setTemplateModalOpen(false)}
        />
      )}

      {webTestOpen && (
        <WebTestCallModal
          open={webTestOpen}
          onOpenChange={setWebTestOpen}
          agentId={id!}
          agentName={agent.name}
          onGoFix={(notes) => {
            setWebTestOpen(false);
            setTimeout(() => {
              personaCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              if (notes) {
                objectiveRef.current?.focus();
              }
            }, 100);
          }}
        />
      )}

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
      .catch(() => {
        toast.error("Failed to load call status");
      });

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
    <Card className="gap-0 overflow-visible py-0 shadow-card">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 font-medium">
            <Phone className="w-4 h-4" />
            Test call
            <Badge variant="secondary" className={`${isEnded ? "bg-muted text-foreground" : "bg-success/15 text-success"}`}>{isEnded ? null : <span className="size-1.5 rounded-full bg-current mr-1" />}
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
      </div>
      <CardContent className="px-6 py-5">
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
      </CardContent>
    </Card>
  );
}

type ChangeTemplateModalProps = {
  agent: Agent | null;
  onApply: (preset: any, mode: "replace" | "merge") => void;
  onClose: () => void;
};

function ChangeTemplateModal({ agent, onApply, onClose }: ChangeTemplateModalProps) {
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [selectedPreset, setSelectedPreset] = useState<any | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("merge");

  function handlePresetSelect(preset: any) {
    setSelectedPreset(preset);
    setStep("confirm");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-bg border border-border rounded-xl shadow-elevated w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="font-semibold">
            {step === "pick" ? "Change template" : "Apply template"}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === "pick" ? (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <AgentPresetPicker
              verticalKey={agent?.vertical || undefined}
              showAllVerticals={true}
              onSelect={handlePresetSelect}
              onSkip={onClose}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <p className="text-sm font-medium">How do you want to apply "{selectedPreset?.name}"?</p>
              <p className="text-xs text-text-muted mt-1">
                This affects objective, guardrails, tone, opening message, and identity.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setMode("merge")}
                className={`w-full text-left p-4 rounded-md border transition-all ${
                  mode === "merge"
                    ? "border-primary bg-primary/[0.03] ring-1 ring-primary/20"
                    : "border-border bg-surface hover:border-text/20"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <WrapText className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-medium">Merge rules</span>
                  {mode === "merge" && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                </div>
                <p className="text-xs text-text-muted pl-6">
                  Appends the template's guardrails to your existing ones. Preserves your objective, tone, and opening message.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode("replace")}
                className={`w-full text-left p-4 rounded-md border transition-all ${
                  mode === "replace"
                    ? "border-primary bg-primary/[0.03] ring-1 ring-primary/20"
                    : "border-border bg-surface hover:border-text/20"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <LayoutTemplate className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-medium">Replace prompt</span>
                  {mode === "replace" && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                </div>
                <p className="text-xs text-text-muted pl-6">
                  Overwrites objective, guardrails, tone, opening message, and identity with the template's values. Your changes will be lost unless you save first.
                </p>
              </button>
            </div>

            <div className="flex justify-between gap-3 pt-2">
              <Button variant="ghost" onClick={() => setStep("pick")}>
                Back
              </Button>
              <Button onClick={() => onApply(selectedPreset, mode)}>
                Apply template
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

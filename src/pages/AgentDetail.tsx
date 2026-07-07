import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  ChevronDown,
  Check,
  Phone,
  X,
  Mic,
  RefreshCw,
  ChevronRight,
  TriangleAlert as AlertTriangle,
  Zap,
  Globe,
  LayoutTemplate,
  MessageSquare,
  WrapText,
  Clock,
  MoreHorizontal,
  Trash2,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { getAgent, listVoices, listAgentKnowledge, getCall, listCalls } from "../lib/db";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import VoiceLibrary from "./VoiceLibrary";
import { WebTestCallModal } from "@/components/WebTestCallModal";
import { WebTestPanel } from "@/components/WebTestPanel";
import { VariablesPanel } from "@/components/VariablesPanel";
import { AgentPresetPicker } from "@/components/AgentPresetPicker";
import { PromptHistoryDrawer } from "@/components/PromptHistoryDrawer";
import { usePageTitle } from "../hooks/usePageTitle";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";

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

// Snapshot of loaded agent fields for dirty tracking
type DraftState = {
  name: string;
  objective: string;
  toneMode: string;
  customTone: string;
  businessName: string;
  firstMessage: string;
  guardrails: string;
  identity: string;
  transferNumber: string;
  timezone: string;
  selectedLanguages: string[];
  languageMessages: Record<string, string>;
  boostKeywords: string[];
  conversationStyle: "quick" | "balanced" | "patient";
  recordVoice: boolean;
  zeroRetentionMode: boolean;
};

const TAB_KEYS = ["behavior", "voice", "skills", "activity", "advanced"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function serializeDraft(d: DraftState): string {
  return JSON.stringify({ ...d, selectedLanguages: [...d.selectedLanguages].sort(), boostKeywords: [...d.boostKeywords] });
}

export default function AgentDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromCallId = searchParams.get("from_call");
  const tabParam = (searchParams.get("tab") as TabKey | null) ?? "behavior";
  const activeTab = TAB_KEYS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "behavior";

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
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fromCall, setFromCall] = useState<any>(null);
  const [fromCallLoading, setFromCallLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);

  // Inline name editing
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  // Saved snapshot for dirty tracking
  const [savedDraft, setSavedDraft] = useState<string>("");

  const objectiveRef = useRef<HTMLTextAreaElement>(null);
  const guardrailsRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusedField = useRef<"objective" | "guardrails" | null>(null);

  // Test call
  const [testNumber, setTestNumber] = useState("");
  const [calling, setCalling] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [webTestOpen, setWebTestOpen] = useState(false);
  const [lastWebTestAt, setLastWebTestAt] = useState<string | null>(null);
  const [testSessionStarted, setTestSessionStarted] = useState(false);

  // Skills
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [activeSkillIds, setActiveSkillIds] = useState<Set<string>>(new Set());
  const [skillsLoading, setSkillsLoading] = useState(false);

  // Dirty state
  const currentDraft = useCallback((): DraftState => ({
    name, objective, toneMode, customTone, businessName, firstMessage,
    guardrails, identity, transferNumber, timezone, selectedLanguages,
    languageMessages, boostKeywords, conversationStyle, recordVoice, zeroRetentionMode,
  }), [name, objective, toneMode, customTone, businessName, firstMessage,
    guardrails, identity, transferNumber, timezone, selectedLanguages,
    languageMessages, boostKeywords, conversationStyle, recordVoice, zeroRetentionMode]);

  const isDirty = savedDraft !== "" && serializeDraft(currentDraft()) !== savedDraft;

  function setTab(t: TabKey) {
    setSearchParams((prev) => { prev.set("tab", t); return prev; }, { replace: true });
  }

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
        typeof privacyCfg.store_audio === "boolean" ? privacyCfg.store_audio
          : typeof privacyCfg.record_voice === "boolean" ? privacyCfg.record_voice : true
      );
      setZeroRetentionMode(
        typeof privacyCfg.zero_retention === "boolean" ? privacyCfg.zero_retention
          : typeof privacyCfg.zero_retention_mode === "boolean" ? privacyCfg.zero_retention_mode : false
      );

      if (a.voice_id) {
        const voices = await listVoices();
        const match = voices.find((v: any) => v.voice_id === a.voice_id);
        setVoiceName(match?.name || a.voice_id);
        const voiceLangs: string[] = match?.language_codes || ["en"];
        const unsupported = langs.filter((l: string) => !voiceLangs.includes(l));
        setLangVoiceWarning(unsupported);
      } else {
        setVoiceName("Default (Rachel)");
        setLangVoiceWarning([]);
      }

      const kb = await listAgentKnowledge(id!);
      setKnowledge(kb);

      const [skillsRes, activeRes] = await Promise.all([
        api.get<{ skills: any[] }>("/v1/skills"),
        api.get<{ skills: any[] }>(`/v1/agents/${id}/skills`),
      ]);
      setAllSkills(skillsRes.skills || []);
      setActiveSkillIds(new Set((activeRes.skills || []).map((s: any) => s.skill_id)));

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
      } catch { /* non-fatal */ }

      // Load recent calls for the activity tab / rail
      try {
        const { data: calls } = await listCalls({ agent_id: id, limit: 10 });
        setRecentCalls(calls || []);
      } catch { /* non-fatal */ }

      // Snapshot for dirty tracking — set after all state is applied
      const snap: DraftState = {
        name: a.name || "",
        objective: a.persona?.objective || "",
        toneMode: (() => {
          const t = a.persona?.tone || "";
          return (TONE_PRESETS as readonly string[]).includes(t) || !t ? (t || TONE_PRESETS[0]) : "custom";
        })(),
        customTone: (() => {
          const t = a.persona?.tone || "";
          return (TONE_PRESETS as readonly string[]).includes(t) || !t ? "" : t;
        })(),
        businessName: a.persona?.business_name || "",
        firstMessage: a.persona?.first_message || a.persona?.opening_message || "",
        guardrails: Array.isArray(a.persona?.guardrails)
          ? (a.persona.guardrails as string[]).join("\n") : a.persona?.guardrails || "",
        identity: a.persona?.identity || "",
        transferNumber: a.transfer_number || "",
        timezone: a.timezone || "America/New_York",
        selectedLanguages: (a.languages || ["en"]).map((l: string) => l.trim().toLowerCase().slice(0, 5)).filter(Boolean),
        languageMessages: a.persona?.first_message_overrides || a.persona?.language_messages || {},
        boostKeywords: Array.isArray(a.persona?.boost_keywords) ? a.persona.boost_keywords : [],
        conversationStyle: a.persona?.conversation_style || "balanced",
        recordVoice: (() => {
          const p = a.persona?.privacy || a.persona?.privacy_config || {};
          return typeof p.store_audio === "boolean" ? p.store_audio : typeof p.record_voice === "boolean" ? p.record_voice : true;
        })(),
        zeroRetentionMode: (() => {
          const p = a.persona?.privacy || a.persona?.privacy_config || {};
          return typeof p.zero_retention === "boolean" ? p.zero_retention : typeof p.zero_retention_mode === "boolean" ? p.zero_retention_mode : false;
        })(),
      };
      setSavedDraft(serializeDraft(snap));
    } catch {
      toast.error("Failed to load agent");
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!fromCallId) return;
    setFromCallLoading(true);
    getCall(fromCallId).then(setFromCall).catch(() => setFromCall(null)).finally(() => setFromCallLoading(false));
  }, [fromCallId]);

  useEffect(() => {
    if (!agent?.voice_id) return;
    (async () => {
      const voices = await listVoices();
      const match = voices.find((v: any) => v.voice_id === agent.voice_id);
      const voiceLangs: string[] = match?.language_codes || ["en"];
      setLangVoiceWarning(selectedLanguages.filter((l) => !voiceLangs.includes(l)));
    })();
  }, [selectedLanguages, agent?.voice_id]);

  async function save() {
    if (!agent) return;
    setSaving(true);
    try {
      const effectiveTone = toneMode === "custom" ? customTone : toneMode;
      const guardrailsValue = guardrails.trim()
        ? guardrails.split("\n").map((s) => s.trim()).filter(Boolean) : [];
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

  async function handleVoiceSelect(voiceId: string, vname: string) {
    setVoiceDrawerOpen(false);
    try {
      await api.patch(`/v1/agents/${id}`, { voice_id: voiceId });
      toast.success(`Voice changed to ${vname}.`);
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
      setObjective((v) => v + (v.endsWith(" ") || v === "" ? "" : " ") + snippet);
      toast.success(`Inserted ${snippet} into Objective`);
      return;
    }
    const el = ref.current;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + snippet + el.value.slice(end);
    if (field === "objective") setObjective(next);
    else setGuardrails(next);
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
      setGuardrails(Array.isArray(p.guardrails) ? p.guardrails.join("\n") : p.guardrails || "");
      setIdentity(p.identity || "");
      setFirstMessage(p.first_message || p.opening_message || "");
      const tone = p.tone || "";
      const isPreset = (TONE_PRESETS as readonly string[]).includes(tone);
      if (!tone || isPreset) { setToneMode(tone || TONE_PRESETS[0]); setCustomTone(""); }
      else { setToneMode("custom"); setCustomTone(tone); }
      toast.success(`Prompt replaced with "${preset.name}" template.`);
    } else {
      const newGuardrails = Array.isArray(p.guardrails) ? p.guardrails.join("\n") : p.guardrails || "";
      if (newGuardrails) {
        setGuardrails((prev) => { const t = prev.trim(); return t ? `${t}\n${newGuardrails}` : newGuardrails; });
      }
      if (p.identity && !identity) setIdentity(p.identity);
      toast.success(`Rules from "${preset.name}" merged into guardrails.`);
    }
    setTemplateModalOpen(false);
  }

  async function handleDelete() {
    if (!agent) return;
    setDeleting(true);
    try {
      await api.delete(`/v1/agents/${id}`);
      toast.success("Agent deleted.");
      navigate("/agents");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete agent.");
      setDeleting(false);
    }
  }

  function handleDiscard() {
    load();
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!agent) return <div className="p-6 text-sm text-text-muted">Agent not found.</div>;

  const direction = agent.persona?.direction || "inbound";
  const syncBadge = (() => {
    if (agent.sync_status === "synced") return <Badge variant="secondary" className="bg-success/15 text-success text-xs">Live</Badge>;
    if (agent.sync_status === "pending") return <Badge variant="secondary" className="bg-warning/15 text-warning text-xs">Pending</Badge>;
    if (agent.sync_status === "failed") return <Badge variant="secondary" className="bg-danger/15 text-danger text-xs">Sync failed</Badge>;
    return <Badge variant="secondary" className="text-xs">Draft</Badge>;
  })();

  return (
    <div className="min-h-screen pb-32">
      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 px-6 py-3">
          {/* Back */}
          <Link to="/agents" className="shrink-0 p-1.5 -ml-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>

          {/* Name (inline editable) */}
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingName(false); }}
                className="text-base font-semibold bg-transparent border-b border-foreground/30 outline-none w-full max-w-sm leading-tight py-0.5"
                autoFocus
              />
            ) : (
              <button
                onClick={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.select(), 20); }}
                className="text-base font-semibold truncate max-w-sm text-left hover:opacity-70 transition-opacity leading-tight group flex items-center gap-1.5"
                title="Click to rename"
              >
                {name || agent.name}
              </button>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              {syncBadge}
              <span className="text-xs text-muted-foreground capitalize">{direction} · {agent.provider}</span>
              {selectedLanguages.slice(0, 3).map((l) => (
                <span key={l} className="px-1.5 py-0 rounded border border-border text-[10px] font-mono text-muted-foreground">{l}</span>
              ))}
              {selectedLanguages.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{selectedLanguages.length - 3}</span>
              )}
              {voiceName && (
                <span className="text-xs text-muted-foreground hidden sm:inline">{voiceName}</span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => setWebTestOpen(true)}
              disabled={!agent.provider_ref}
              className="hidden sm:flex"
            >
              <Mic className="w-3.5 h-3.5 mr-1.5" />
              Talk to agent
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="w-8 h-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setWebTestOpen(true)} className="sm:hidden">
                  <Mic className="w-4 h-4 mr-2" />
                  Talk to agent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                  <History className="w-4 h-4 mr-2" />
                  Prompt history
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTemplateModalOpen(true)}>
                  <LayoutTemplate className="w-4 h-4 mr-2" />
                  Change template
                </DropdownMenuItem>
                {agent.sync_status === "failed" && (
                  <DropdownMenuItem onClick={retrySync} disabled={syncing}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                    Retry sync
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete agent
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Sync failure banner */}
        {agent.sync_status === "failed" && (
          <div className="flex items-center gap-3 px-6 py-2 bg-danger/10 border-b border-danger/20 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" />
            <span className="text-danger font-medium">Provider sync failed.</span>
            {agent.sync_error && <span className="text-text-muted truncate">{agent.sync_error}</span>}
            <Button variant="outline" size="sm" onClick={retrySync} disabled={syncing} className="ml-auto shrink-0 h-6 text-xs">
              <RefreshCw className={`w-3 h-3 mr-1 ${syncing ? "animate-spin" : ""}`} />
              Retry
            </Button>
          </div>
        )}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex gap-0">
        {/* Tabs area */}
        <div className="flex-1 min-w-0">
          {/* from_call banner */}
          {fromCallId && (
            <div className="mx-6 mt-4">
              <Card className="gap-0 overflow-visible py-0 shadow-card border-amber-200 bg-amber-50/30">
                <div className="border-b border-amber-200 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm font-medium">Improving from call</span>
                    <span className="font-mono text-xs opacity-70">{fromCallId.slice(0, 8)}…</span>
                  </div>
                  <Link to={`/agents/${id}`} replace className="p-1 rounded text-amber-600 hover:text-amber-800 hover:bg-amber-100 transition-colors" aria-label="Dismiss">
                    <X className="w-4 h-4" />
                  </Link>
                </div>
                {fromCallLoading ? (
                  <div className="px-5 py-4 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-20 w-full" /></div>
                ) : fromCall ? (
                  <CardContent className="px-5 py-4 space-y-3">
                    <div className="flex items-center gap-4 text-xs text-amber-700 flex-wrap">
                      <span className="capitalize font-medium">{fromCall.status?.replace(/_/g, " ")}</span>
                      {fromCall.duration_sec != null && <span>{fromCall.duration_sec}s</span>}
                      {fromCall.hangup_by && <span>Hung up by <span className="capitalize">{fromCall.hangup_by}</span></span>}
                      {fromCall.cost_usd != null && <span>${Number(fromCall.cost_usd).toFixed(3)}</span>}
                    </div>
                    {Array.isArray(fromCall.transcript) && fromCall.transcript.length > 0 && (
                      <div>
                        <p className="section-label mb-2">Transcript</p>
                        <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-md border border-amber-200 bg-white/60 p-3">
                          {fromCall.transcript.map((t: any, i: number) => {
                            const speaker = t.role || t.speaker || "agent";
                            const isAgent = speaker === "agent" || speaker === "assistant";
                            return (
                              <div key={i} className="text-xs">
                                <span className={`font-medium mr-1.5 ${isAgent ? "text-amber-800" : "text-zinc-500"}`}>{isAgent ? "Agent" : "User"}:</span>
                                <span className="text-zinc-700">{t.text || t.content}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                ) : (
                  <div className="px-5 py-4 text-sm text-amber-700">Call not found.</div>
                )}
              </Card>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setTab(v as TabKey)} className="flex-col">
            <div className="px-6 pt-4 pb-0 border-b border-border">
              <TabsList variant="line" className="h-auto gap-0 rounded-none p-0 bg-transparent w-full justify-start overflow-x-auto">
                {TAB_KEYS.map((t) => (
                  <TabsTrigger
                    key={t}
                    value={t}
                    className="capitalize px-4 py-2.5 rounded-none text-sm h-auto border-0 shrink-0"
                  >
                    {t}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ── BEHAVIOR tab ─────────────────────────────── */}
            <TabsContent value="behavior" className="m-0">
              <div className="flex gap-6 px-6 pt-6 pb-4 items-start">
                {/* Editor column */}
                <div className="flex-1 min-w-0 max-w-2xl space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Display name">
                      <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </Field>
                    <Field label="Business name">
                      <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Lakeshore Family Clinic" />
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
                    <Field label="Opening message">
                      <Input value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} placeholder="Hello, thanks for calling. How can I help?" />
                    </Field>
                    <Field label="Tone">
                      <Select value={toneMode} onValueChange={setToneMode}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select tone" /></SelectTrigger>
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
                        <Input value={customTone} onChange={(e) => setCustomTone(e.target.value)} placeholder="Playful yet authoritative, like a knowledgeable friend" />
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
                      <Input value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder="You are Maya, a billing assistant at Acme Corp." />
                    </Field>
                  </div>

                  <VariablesPanel
                    promptText={`${objective}\n${firstMessage}\n${identity}\n${guardrails}`}
                    onInsert={handleInsertVariable}
                  />

                  {langVoiceWarning.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-warning">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Voice may not support:{" "}
                      {langVoiceWarning.map((c) => LANGUAGE_OPTIONS.find((l) => l.code === c)?.label ?? c).join(", ")}
                    </div>
                  )}

                  {/* Prompt preview toggle */}
                  <div>
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
                    {promptOpen && (
                      <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border">
                        {promptLoading ? <Skeleton className="h-32" /> : (
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{promptPreview}</pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Variables panel docked right at xl */}
                <div className="hidden xl:block w-64 shrink-0 space-y-4 pt-0.5">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                    <p className="section-label">Prompt history</p>
                    <button
                      onClick={() => setHistoryOpen(true)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Clock className="w-4 h-4" />
                      View history
                    </button>
                    <button
                      onClick={() => setTemplateModalOpen(true)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <LayoutTemplate className="w-4 h-4" />
                      Change template
                    </button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── VOICE tab ─────────────────────────────────── */}
            <TabsContent value="voice" className="m-0">
              <div className="px-6 pt-6 pb-4 max-w-2xl space-y-6">
                {/* Voice picker */}
                <div>
                  <p className="section-label mb-3">Voice</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-10 px-3 rounded-md border border-border bg-muted/40 flex items-center font-mono text-sm text-muted-foreground truncate">
                      {voiceName}
                    </div>
                    <Button variant="outline" onClick={() => setVoiceDrawerOpen(true)}>
                      <Mic className="w-4 h-4 mr-1.5" />
                      Change voice
                    </Button>
                  </div>
                </div>

                {/* Languages */}
                <div>
                  <p className="section-label mb-3">Languages</p>
                  <LanguagePicker selected={selectedLanguages} onChange={setSelectedLanguages} />
                  {langVoiceWarning.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-warning">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Voice may not support:{" "}
                      {langVoiceWarning.map((c) => LANGUAGE_OPTIONS.find((l) => l.code === c)?.label ?? c).join(", ")}
                    </div>
                  )}
                </div>

                {/* Per-language opening messages */}
                {selectedLanguages.length > 1 && (
                  <div className="border border-border rounded-lg p-4 bg-muted/20">
                    <button
                      type="button"
                      onClick={() => setShowLanguageOverrides(!showLanguageOverrides)}
                      className="flex items-center justify-between w-full text-sm font-medium text-text hover:text-primary transition-colors"
                    >
                      <span>Opening message per language (optional)</span>
                      {showLanguageOverrides ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    {showLanguageOverrides && (
                      <div className="mt-4 space-y-3 pt-3 border-t border-border">
                        {selectedLanguages.slice(1).map((lang) => {
                          const opt = LANGUAGE_OPTIONS.find((l) => l.code === lang);
                          return (
                            <div key={lang} className="space-y-1">
                              <label className="text-[11px] font-medium text-muted-foreground">
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
                        <p className="text-[10px] text-muted-foreground">Leave blank to use the default opening message.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Conversation style */}
                <div>
                  <p className="section-label mb-3">Conversation style</p>
                  <div className="flex gap-1 p-1 bg-muted/50 rounded-md border border-border w-fit">
                    {(["quick", "balanced", "patient"] as const).map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setConversationStyle(style)}
                        className={`px-3 py-1 text-xs rounded transition-colors capitalize ${
                          conversationStyle === style
                            ? "bg-background text-foreground font-medium border border-border shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {conversationStyle === "quick" && "Short pauses, eager responses — ideal for transactional calls."}
                    {conversationStyle === "balanced" && "Natural pacing — suitable for most use cases."}
                    {conversationStyle === "patient" && "Long pauses allowed — ideal for complex or slow-paced conversations."}
                  </p>
                </div>

                {/* Deployment info */}
                <div>
                  <p className="section-label mb-3">Deployment</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Provider Agent ID">
                      <div className="h-10 px-3 rounded-md border border-border bg-muted/40 flex items-center font-mono text-xs text-muted-foreground">
                        {agent.provider_ref || agent.provider_agent_id || "Not provisioned"}
                      </div>
                    </Field>
                    <Field label="Conversation Config ID">
                      <div className="h-10 px-3 rounded-md border border-border bg-muted/40 flex items-center font-mono text-xs text-muted-foreground">
                        {agent.conversation_config_id || "None"}
                      </div>
                    </Field>
                    <Field label="Sync Status">
                      <div className="h-10 px-3 rounded-md border border-border bg-muted/40 flex items-center gap-2">
                        {syncBadge}
                      </div>
                    </Field>
                  </div>
                </div>

                {/* Linked knowledge */}
                <div>
                  <p className="section-label mb-3">Linked knowledge</p>
                  <div className="border border-border rounded-md divide-y divide-border bg-muted/20">
                    {knowledge.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground">No knowledge sources linked. Attach sources from the Integrations page.</div>
                    ) : knowledge.map((k: any) => (
                      <div key={k.source_id || k.id} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-medium">{k.knowledge_sources?.title || "Source"}</div>
                          <div className="text-muted-foreground capitalize">{k.knowledge_sources?.kind}</div>
                        </div>
                        <Badge variant="secondary" className={k.knowledge_sources?.status === "ready" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}>
                          {k.knowledge_sources?.status || "pending"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── SKILLS tab ─────────────────────────────────── */}
            <TabsContent value="skills" className="m-0">
              <div className="px-6 pt-6 pb-4 max-w-2xl">
                <p className="text-sm text-muted-foreground mb-4">
                  Toggle capabilities for this agent. Changes sync to the provider on next save.
                </p>
                {allSkills.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No skills available.</div>
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
                              if (isActive) next.delete(skill.id); else next.add(skill.id);
                              return next;
                            });
                            try {
                              await api.post(`/v1/agents/${id}/skills/${skill.id}/toggle`, { enabled: !isActive });
                            } catch (e: any) {
                              setActiveSkillIds((prev) => {
                                const next = new Set(prev);
                                if (isActive) next.add(skill.id); else next.delete(skill.id);
                                return next;
                              });
                              toast.error(e.message || "Failed to toggle skill.");
                            } finally {
                              setSkillsLoading(false); }
                          }}
                          className={cn(
                            "text-left p-4 rounded-xl border transition-all",
                            isActive ? "border-foreground/20 bg-foreground/5" : "border-border bg-background hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium">{skill.name}</span>
                            <div className={cn("w-8 h-4 rounded-full transition-colors flex items-center px-0.5", isActive ? "bg-emerald-500 justify-end" : "bg-border justify-start")}>
                              <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-2">{skill.description}</div>
                          <Badge variant="secondary" className="mt-2 text-[10px]">{skill.category}</Badge>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── ACTIVITY tab ──────────────────────────────── */}
            <TabsContent value="activity" className="m-0">
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="section-label">Recent calls</p>
                  <button onClick={() => setHistoryOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Clock className="w-3.5 h-3.5" />
                    Prompt history
                  </button>
                </div>
                {recentCalls.length === 0 ? (
                  <div className="border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
                    No calls yet for this agent.
                  </div>
                ) : (
                  <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                    {recentCalls.map((call: any) => {
                      const isSuccess = ["completed", "success"].includes(call.status);
                      const isFailed = ["failed", "no_answer", "busy"].includes(call.status);
                      return (
                        <div key={call.id} className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-muted/30 transition-colors">
                          <div className={cn("w-2 h-2 rounded-full shrink-0", isSuccess ? "bg-emerald-500" : isFailed ? "bg-red-400" : "bg-amber-400")} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium capitalize text-xs">{call.status?.replace(/_/g, " ")}</span>
                              <span className="text-xs text-muted-foreground capitalize">{call.direction}</span>
                              {call.channel && call.channel !== "phone" && (
                                <Badge variant="secondary" className="text-[10px]">{call.channel}</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {call.created_at ? formatRelative(call.created_at) : "—"}
                              {call.duration_sec != null && <span className="ml-2 num">{call.duration_sec}s</span>}
                              {call.cost_usd != null && <span className="ml-2 num">${Number(call.cost_usd).toFixed(3)}</span>}
                            </div>
                          </div>
                          <Link to={`/calls?agent=${id}`} className="text-xs text-muted-foreground hover:text-foreground shrink-0">
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-4">
                  <Link to={`/calls?agent=${id}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
                    View all calls <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </TabsContent>

            {/* ── ADVANCED tab ──────────────────────────────── */}
            <TabsContent value="advanced" className="m-0">
              <div className="px-6 pt-6 pb-4 max-w-2xl space-y-8">
                {/* Boost keywords */}
                <div>
                  <p className="section-label mb-3">Boost keywords (ASR)</p>
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
                          <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border text-xs font-mono">
                            {kw}
                            <button
                              type="button"
                              onClick={() => setBoostKeywords((prev) => prev.filter((k) => k !== kw))}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              aria-label={`Remove ${kw}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Brand or product names the agent should recognize accurately. (Max 50.)</p>
                  </div>
                </div>

                {/* Timezone + Transfer */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Timezone">
                    <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                  </Field>
                  <Field label="Human transfer number">
                    <Input value={transferNumber} onChange={(e) => setTransferNumber(e.target.value)} placeholder="+14155551234" className="font-mono" />
                  </Field>
                </div>

                {/* Privacy */}
                <div>
                  <p className="section-label mb-3">Privacy &amp; data retention</p>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Record voice</div>
                        <p className="text-xs text-muted-foreground mt-0.5">Store call audio in ElevenLabs for transcript and analytics.</p>
                      </div>
                      <Switch checked={recordVoice} onCheckedChange={setRecordVoice} aria-label="Record voice" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Zero retention mode</div>
                        <p className="text-xs text-muted-foreground mt-0.5">ElevenLabs retains no data from this agent's conversations.</p>
                      </div>
                      <Switch checked={zeroRetentionMode} onCheckedChange={setZeroRetentionMode} aria-label="Zero retention mode" />
                    </div>
                    {zeroRetentionMode && (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-xs text-warning">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Zero retention mode disables transcripts, recordings, and evaluation analysis. Ensure this complies with your legal obligations.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Analysis config preview */}
                {agent.persona?.analysis_config && (
                  <div>
                    <p className="section-label mb-3">Analysis config</p>
                    <pre className="text-xs font-mono text-muted-foreground bg-muted/40 border border-border rounded-lg p-4 overflow-x-auto">
                      {JSON.stringify(agent.persona.analysis_config, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Danger zone */}
                <div className="border border-destructive/30 rounded-xl p-5 space-y-3">
                  <p className="section-label text-destructive">Danger zone</p>
                  <p className="text-sm text-muted-foreground">
                    Deleting this agent removes it from your organization and de-provisions it from ElevenLabs. This cannot be undone.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete agent
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Test rail (≥lg) ─────────────────────────────── */}
        <div className="hidden lg:flex flex-col w-80 shrink-0 border-l border-border sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
          <div className="p-5 space-y-4 flex-1">
            <div className="flex items-center justify-between">
              <p className="section-label">Test agent</p>
              {lastWebTestAt && (
                <span className="text-[10px] text-muted-foreground">Last {formatRelative(lastWebTestAt)}</span>
              )}
            </div>

            {agent.provider_ref ? (
              <WebTestPanel
                agentId={id!}
                agentName={agent.name}
                transcriptHeight="h-[180px]"
                onSessionStart={() => setTestSessionStarted(true)}
                onGoFix={(notes) => {
                  setTestSessionStarted(false);
                  setTab("behavior");
                  setTimeout(() => objectiveRef.current?.focus(), 150);
                  if (notes) toast.info("Notes captured — check behavior tab.");
                }}
              />
            ) : (
              <div className="text-xs text-muted-foreground p-4 rounded-lg border border-border bg-muted/30 text-center">
                Save the agent first to enable browser testing.
              </div>
            )}

            {/* Recent calls mini-list */}
            {recentCalls.length > 0 && (
              <div className="space-y-2">
                <p className="section-label">Recent calls</p>
                {recentCalls.slice(0, 3).map((call: any) => {
                  const isSuccess = ["completed", "success"].includes(call.status);
                  const isFailed = ["failed", "no_answer", "busy"].includes(call.status);
                  return (
                    <div key={call.id} className="flex items-center gap-2.5 text-xs">
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", isSuccess ? "bg-emerald-500" : isFailed ? "bg-red-400" : "bg-amber-400")} />
                      <span className="text-muted-foreground capitalize flex-1 truncate">{call.status?.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground/60 shrink-0">{call.created_at ? formatRelative(call.created_at) : "—"}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Phone test */}
            <div className="pt-3 border-t border-border space-y-2">
              <p className="section-label">Phone test</p>
              <Input
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
                disabled={!agent.provider_ref || calling}
                placeholder="+1 415 555 0199"
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
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
                {calling ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Phone className="w-3.5 h-3.5 mr-1.5" />}
                {calling ? "Calling…" : "Call phone"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── FAB for mobile test (<lg, hidden when save bar is visible) ── */}
      {!isDirty && (
        <button
          onClick={() => setWebTestOpen(true)}
          disabled={!agent.provider_ref}
          className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-foreground text-background shadow-elevated flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40"
          aria-label="Test agent"
        >
          <Mic className="w-6 h-6" />
        </button>
      )}

      {/* ── Sticky save bar ─────────────────────────────────────────────── */}
      {isDirty && (
        <div className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-between gap-4 px-6 py-3 bg-background/95 backdrop-blur-sm border-t border-border shadow-elevated animate-slide-up">
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDiscard} disabled={saving}>
              Discard
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              {saving ? "Saving…" : "Save & update agent"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Modals & drawers ─────────────────────────────────────────────── */}
      {historyOpen && (
        <PromptHistoryDrawer agentId={id!} onRestore={load} onClose={() => setHistoryOpen(false)} />
      )}

      {templateModalOpen && (
        <ChangeTemplateModal agent={agent} onApply={handleApplyTemplate} onClose={() => setTemplateModalOpen(false)} />
      )}

      {webTestOpen && (
        <WebTestCallModal
          open={webTestOpen}
          onOpenChange={setWebTestOpen}
          agentId={id!}
          agentName={agent.name}
          onGoFix={(notes) => {
            setWebTestOpen(false);
            setTab("behavior");
            setTimeout(() => objectiveRef.current?.focus(), 150);
          }}
        />
      )}

      {activeCallId && (
        <TestCallDrawer callId={activeCallId} onClose={() => setActiveCallId(null)} />
      )}

      {voiceDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setVoiceDrawerOpen(false)} />
          <div className="relative bg-background border border-border rounded-xl shadow-elevated w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="font-semibold">Choose a voice</div>
              <button onClick={() => setVoiceDrawerOpen(false)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <VoiceLibrary onSelect={handleVoiceSelect} selectedVoiceId={agent.voice_id || undefined} filterLanguages={selectedLanguages} />
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the agent from your organization and de-provisions it from ElevenLabs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete agent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function LanguagePicker({ selected, onChange }: { selected: string[]; onChange: (langs: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
        className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm flex items-center justify-between gap-2 text-left"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-elevated overflow-hidden">
          <ul className="max-h-56 overflow-y-auto py-1">
            {LANGUAGE_OPTIONS.map((l) => {
              const isSelected = selected.includes(l.code);
              return (
                <li key={l.code}>
                  <button
                    type="button"
                    onClick={() => toggle(l.code)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                  >
                    <span className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors", isSelected ? "bg-foreground border-foreground" : "border-border")}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-background" />}
                    </span>
                    <span className={isSelected ? "font-medium" : ""}>{l.label}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{l.code}</span>
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

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
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
    const timer = setInterval(() => { setElapsed(Math.floor((Date.now() - startTime.current) / 1000)); }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`call_events_${callId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_events", filter: `call_id=eq.${callId}` },
        (payload: any) => {
          const event = payload.new;
          if (event.kind === "transcript") {
            setTranscript((prev) => [...prev, { role: event.metadata?.role || "agent", text: event.metadata?.text || "" }]);
          } else if (event.kind === "status_change") {
            setCallStatus(event.metadata?.status || event.metadata?.new_status || "in_progress");
          }
        }
      ).subscribe();

    getCall(callId).then((data) => { if (data?.status) setCallStatus(data.status); }).catch(() => {});
    return () => { supabase.removeChannel(channel); };
  }, [callId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript]);

  const isEnded = ["completed", "failed", "no_answer", "busy"].includes(callStatus);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <Card className="gap-0 overflow-visible py-0 shadow-card mx-6 mt-4">
      <div className="border-b px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 font-medium text-sm">
          <Phone className="w-4 h-4" />
          Test call
          <Badge variant="secondary" className={isEnded ? "" : "bg-success/15 text-success"}>
            {!isEnded && <span className="size-1.5 rounded-full bg-current mr-1" />}
            {callStatus.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground num">{minutes}:{seconds.toString().padStart(2, "0")}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      </div>
      <CardContent className="px-5 py-4">
        <div ref={scrollRef} className="h-44 overflow-y-auto space-y-2 bg-muted/30 rounded-md p-3 border border-border">
          {transcript.length === 0 ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              {!isEnded && <Loader2 className="w-3 h-3 animate-spin" />}
              {isEnded ? "No transcript received." : "Waiting for conversation to start…"}
            </div>
          ) : (
            transcript.map((t, i) => (
              <div key={i} className={`text-xs ${t.role === "agent" ? "text-foreground" : "text-muted-foreground"}`}>
                <span className="font-medium capitalize">{t.role}:</span> {t.text}
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-xl shadow-elevated w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="font-semibold">{step === "pick" ? "Change template" : "Apply template"}</div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>
        {step === "pick" ? (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <AgentPresetPicker
              verticalKey={agent?.vertical || undefined}
              showAllVerticals={true}
              onSelect={(preset) => { setSelectedPreset(preset); setStep("confirm"); }}
              onSkip={onClose}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <p className="text-sm font-medium">How do you want to apply "{selectedPreset?.name}"?</p>
              <p className="text-xs text-muted-foreground mt-1">This affects objective, guardrails, tone, opening message, and identity.</p>
            </div>
            <div className="space-y-3">
              {(["merge", "replace"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "w-full text-left p-4 rounded-md border transition-all",
                    mode === m ? "border-foreground bg-foreground/[0.03] ring-1 ring-foreground/20" : "border-border bg-background hover:border-foreground/20"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {m === "merge" ? <WrapText className="w-4 h-4 shrink-0" /> : <LayoutTemplate className="w-4 h-4 shrink-0" />}
                    <span className="text-sm font-medium capitalize">{m === "merge" ? "Merge rules" : "Replace prompt"}</span>
                    {mode === m && <Check className="w-3.5 h-3.5 ml-auto" />}
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    {m === "merge"
                      ? "Appends the template's guardrails to your existing ones. Preserves your objective, tone, and opening message."
                      : "Overwrites objective, guardrails, tone, opening message, and identity with the template's values."}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex justify-between gap-3 pt-2">
              <Button variant="ghost" onClick={() => setStep("pick")}>Back</Button>
              <Button onClick={() => onApply(selectedPreset, mode)}>Apply template</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

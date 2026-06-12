import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Save, Loader as Loader2, ChevronDown, Check, Phone, X } from "lucide-react";
import { getAgent } from "../lib/db";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { Button } from "../components/legacy-ui/Button";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { Badge } from "../components/legacy-ui/Badge";
import { Skeleton } from "../components/legacy-ui/States";

const TONE_OPTIONS = [
  "warm and professional",
  "calm and reassuring",
  "energetic and friendly",
  "formal and precise",
  "empathetic and supportive",
  "concise and direct",
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
};

export default function AgentDetail() {
  const { id } = useParams();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState<any[]>([]);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [tone, setTone] = useState<string>(TONE_OPTIONS[0]);
  const [businessName, setBusinessName] = useState("");
  const [transferNumber, setTransferNumber] = useState("");
  const [timezone, setTimezone] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["en"]);
  const [testNumber, setTestNumber] = useState("");
  const [calling, setCalling] = useState(false);
  const [callMsg, setCallMsg] = useState<string | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  async function load() {
    try {
      const a = await getAgent(id!);
      setAgent(a);
      setName(a.name || "");
      setObjective(a.persona?.objective || "");
      const savedTone = a.persona?.tone || "";
      const matchedTone = TONE_OPTIONS.find(
        (t) => t.toLowerCase() === savedTone.toLowerCase().trim()
      );
      setTone(matchedTone || (TONE_OPTIONS.includes(savedTone as any) ? savedTone : TONE_OPTIONS[0]));
      setBusinessName(a.persona?.business_name || "");
      setTransferNumber(a.transfer_number || "");
      setTimezone(a.timezone || "America/New_York");
      const langs = (a.languages || ["en"])
        .map((l: string) => l.trim().toLowerCase().slice(0, 5))
        .filter(Boolean);
      setSelectedLanguages(langs.length ? langs : ["en"]);

      const { data: kb } = await supabase
        .from("agent_knowledge")
        .select("*, knowledge_sources(*)")
        .eq("agent_id", id!);
      setKnowledge(kb || []);
    } catch {
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function save() {
    if (!agent) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const persona = {
        ...(agent.persona || {}),
        objective,
        tone,
        business_name: businessName,
      };
      await api.patch(`/v1/agents/${id}`, {
        name,
        persona,
        transfer_number: transferNumber.trim() || undefined,
        timezone: timezone || "America/New_York",
        languages: selectedLanguages,
      });
      setSavedMsg("Saved and synced.");
      load();
    } catch (e: any) {
      const detail = e.details || e.detail;
      if (detail && typeof detail === "object") {
        const fields = Array.isArray(detail)
          ? detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join("; ")
          : detail.detail || detail.message || JSON.stringify(detail);
        setSavedMsg(`Provider error: ${fields}`);
      } else {
        setSavedMsg(e.message || "Couldn't save.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-64" />;
  if (!agent) return <div className="text-sm text-text-muted">Agent not found.</div>;

  const direction = agent.persona?.direction || "inbound";

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/agents"
          className="inline-flex items-center text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to agents
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
            <p className="text-sm text-text-muted mt-1">
              {direction} · {agent.provider}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {agent.sync_status === "synced" && <Badge tone="success">Synced</Badge>}
            {agent.sync_status === "pending" && <Badge tone="warning">Pending</Badge>}
            {agent.sync_status === "failed" && <Badge tone="danger">Failed</Badge>}
            {agent.consent_required && (
              <Badge tone="success" dot>
                consent locked on
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="font-medium">Persona</div>
        </CardHeader>
        <CardBody>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Display name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-border bg-surface"
              />
            </Field>
            <Field label="Business name">
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Lakeshore Family Clinic"
                className="w-full h-10 px-3 rounded-md border border-border bg-surface"
              />
            </Field>
            <Field label="Context (Objective)" full>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                rows={3}
                placeholder="Answer questions and book appointments. Route billing questions to a human."
                className="w-full p-3 rounded-md border border-border bg-surface text-sm"
              />
            </Field>
            <Field label="Tone">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm"
              >
                {TONE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </Field>
            <Field label="Timezone">
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-border bg-surface"
              />
            </Field>
            <Field label="Languages">
              <LanguagePicker
                selected={selectedLanguages}
                onChange={setSelectedLanguages}
              />
            </Field>
            <Field label="Human transfer number">
              <input
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                placeholder="+14155551234"
                className="w-full h-10 px-3 rounded-md border border-border bg-surface font-mono text-sm"
              />
            </Field>
          </div>
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {savedMsg && (
              <span className={`text-sm ${savedMsg.startsWith("Provider error") || savedMsg === "Couldn't save." ? "text-danger" : "text-success"}`}>
                {savedMsg}
              </span>
            )}
          </div>
        </CardBody>
      </Card>

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
            <Field label="Voice ID">
              <div className="h-10 px-3 rounded-md border border-border bg-surface-2 flex items-center font-mono text-xs">
                {agent.voice_id || "Default (Rachel)"}
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

      <Card>
        <CardHeader>
          <div className="font-medium">Place a test call</div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-text-muted mb-4">
            Aurora will call the number below so you can hear your agent live.
            Requires ElevenLabs provider to be configured.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              disabled={!agent.provider_ref || calling}
              placeholder="+1 415 555 0199"
              className="h-10 px-3 rounded-md border border-border bg-surface flex-1 min-w-[240px] font-mono text-sm disabled:bg-surface-2 disabled:text-text-muted"
            />
            <Button
              disabled={!agent.provider_ref || !testNumber.trim() || calling}
              onClick={async () => {
                setCalling(true);
                setCallMsg(null);
                setActiveCallId(null);
                try {
                  const res = await api.post(`/v1/agents/${id}/test-call`, { to_number: testNumber.trim() });
                  setCallMsg("Call initiated. Your phone should ring shortly.");
                  if (res?.call_id) setActiveCallId(res.call_id);
                } catch (e: any) {
                  setCallMsg(e.message || "Failed to place call.");
                } finally {
                  setCalling(false);
                }
              }}
            >
              {calling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Phone className="w-4 h-4 mr-2" />}
              {calling ? "Calling..." : "Test call"}
            </Button>
          </div>
          {callMsg && (
            <p className="mt-2 text-xs text-text-muted">{callMsg}</p>
          )}
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
      <label className="block text-xs font-medium text-text-muted mb-1">
        {label}
      </label>
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

    supabase
      .from("calls")
      .select("status")
      .eq("id", callId)
      .single()
      .then(({ data }) => {
        if (data?.status) setCallStatus(data.status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
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

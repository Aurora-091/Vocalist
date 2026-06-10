import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Save } from "lucide-react";
import { getAgent, updateAgent } from "../lib/db";
import { supabase } from "../lib/supabase";
import { Button } from "../components/legacy-ui/Button";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { Badge } from "../components/legacy-ui/Badge";
import { Skeleton } from "../components/legacy-ui/States";

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
  const [tone, setTone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [transferNumber, setTransferNumber] = useState("");
  const [timezone, setTimezone] = useState("");
  const [languagesText, setLanguagesText] = useState("");

  async function load() {
    try {
      const a = await getAgent(id!);
      setAgent(a);
      setName(a.name || "");
      setObjective(a.persona?.objective || "");
      setTone(a.persona?.tone || "");
      setBusinessName(a.persona?.business_name || "");
      setTransferNumber(a.transfer_number || "");
      setTimezone(a.timezone || "America/New_York");
      setLanguagesText((a.languages || ["en"]).join(", "));

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
      const languages = languagesText
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
      await updateAgent(id!, {
        name,
        persona,
        transfer_number: transferNumber || null,
        timezone: timezone || "America/New_York",
        languages,
      });
      setSavedMsg("Saved.");
      load();
    } catch (e: any) {
      setSavedMsg(e.message || "Couldn't save.");
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
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="warm and professional"
                className="w-full h-10 px-3 rounded-md border border-border bg-surface"
              />
            </Field>
            <Field label="Timezone">
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-border bg-surface"
              />
            </Field>
            <Field label="Languages (comma-separated)">
              <input
                value={languagesText}
                onChange={(e) => setLanguagesText(e.target.value)}
                placeholder="en, es"
                className="w-full h-10 px-3 rounded-md border border-border bg-surface"
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
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {savedMsg && (
              <span className="text-sm text-text-muted">{savedMsg}</span>
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
            Test calls require the ElevenLabs provider integration to be active.
            Once configured, Aurora will call a phone you control so you can hear
            the agent before going live.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              disabled
              placeholder="+1 415 555 0199"
              className="h-10 px-3 rounded-md border border-border bg-surface-2 flex-1 min-w-[240px] text-text-muted"
            />
            <Button disabled>
              <Play className="w-4 h-4 mr-2" />
              Test call
            </Button>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Requires active provider_ref. Connect ElevenLabs API key in Settings to enable.
          </p>
        </CardBody>
      </Card>
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

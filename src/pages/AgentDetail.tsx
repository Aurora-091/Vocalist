import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Save } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/States";

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
};

export default function AgentDetail() {
  const { id } = useParams();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [tone, setTone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [transferNumber, setTransferNumber] = useState("");
  const [timezone, setTimezone] = useState("");
  const [languagesText, setLanguagesText] = useState("");

  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api<{ agent: Agent }>(`/v1/agents/${id}`);
      const a = r.agent;
      setAgent(a);
      setName(a.name || "");
      setObjective(a.persona?.objective || "");
      setTone(a.persona?.tone || "");
      setBusinessName(a.persona?.business_name || "");
      setTransferNumber(a.transfer_number || "");
      setTimezone(a.timezone || "America/New_York");
      setLanguagesText((a.languages || ["en"]).join(", "));
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
      await api(`/v1/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          persona,
          transfer_number: transferNumber || undefined,
          timezone: timezone || undefined,
          languages,
        }),
      });
      setSavedMsg("Saved.");
      load();
    } catch (e: any) {
      setSavedMsg(e.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function placeTest() {
    if (!testTo) return;
    setTesting(true);
    setTestResult(null);
    try {
      await api(`/v1/agents/${id}/test-call`, {
        method: "POST",
        body: JSON.stringify({ to: testTo }),
      });
      setTestResult("Test call queued. You should be receiving a call shortly.");
    } catch (e: any) {
      setTestResult(e.message || "Couldn't queue the test call.");
    } finally {
      setTesting(false);
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
            <Field label="Objective" full>
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
          <div className="font-medium">Place a test call</div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-text-muted mb-4">
            Aurora calls a phone you control so you can hear the agent before
            going live.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="+1 415 555 0199"
              className="h-10 px-3 rounded-md border border-border bg-surface flex-1 min-w-[240px]"
            />
            <Button onClick={placeTest} disabled={testing || !testTo}>
              <Play className="w-4 h-4 mr-2" />
              {testing ? "Queuing…" : "Test call"}
            </Button>
          </div>
          {testResult && (
            <div className="mt-3 text-sm text-text-muted">{testResult}</div>
          )}
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

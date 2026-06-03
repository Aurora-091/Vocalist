import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/legacy-ui/Button";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";

export default function CampaignNew() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [concurrency, setConcurrency] = useState(5);
  const [maxRetries, setMaxRetries] = useState(2);
  const [callingTz, setCallingTz] = useState("America/New_York");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ agents: any[] }>("/v1/agents");
        const eligible = (r.agents || []).filter(
          (a) => a.persona?.direction !== "inbound"
        );
        setAgents(eligible);
        if (eligible[0]) setAgentId(eligible[0].id);
      } catch {
        setAgents([]);
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const r = await api<{ campaign: any }>("/v1/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name,
          agent_id: agentId,
          concurrency,
          max_retries: maxRetries,
          calling_tz: callingTz,
        }),
      });
      navigate(`/campaigns/${r.campaign.id}`);
    } catch (e: any) {
      setErr(e.message || "Couldn't create campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          to="/campaigns"
          className="inline-flex items-center text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to campaigns
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="text-sm text-text-muted mt-1">
          Aurora dials only contacts with consent on file. Opt-outs are honored
          immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="font-medium">Campaign details</div>
        </CardHeader>
        <CardBody>
          {agents.length === 0 ? (
            <div className="text-sm text-text-muted">
              You need an outbound or both-direction agent before creating a
              campaign.{" "}
              <Link to="/agents" className="text-primary hover:text-primary-700">
                Create one
              </Link>
              .
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Field label="Name">
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border bg-surface"
                  placeholder="June recovery push"
                />
              </Field>
              <Field label="Agent">
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border bg-surface"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Concurrency">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={concurrency}
                    onChange={(e) => setConcurrency(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-md border border-border bg-surface"
                  />
                </Field>
                <Field label="Max retries">
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-md border border-border bg-surface"
                  />
                </Field>
              </div>
              <Field label="Calling timezone">
                <input
                  value={callingTz}
                  onChange={(e) => setCallingTz(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border bg-surface"
                />
              </Field>
              {err && <div className="text-sm text-danger">{err}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => navigate("/campaigns")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating…" : "Create campaign"}
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

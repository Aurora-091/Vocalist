import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/States";

export default function AgentDetail() {
  const { id } = useParams();
  const [agent, setAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api<{ agent: any }>(`/v1/agents/${id}`);
      setAgent(r.agent);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

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
          <pre className="bg-surface-2 rounded-md p-4 text-xs overflow-auto">
            {JSON.stringify(agent.persona || {}, null, 2)}
          </pre>
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

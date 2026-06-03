import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Bot } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/legacy-ui/Button";
import { EmptyState, Skeleton } from "../components/legacy-ui/States";
import { Card, CardBody } from "../components/legacy-ui/Card";
import { Badge } from "../components/legacy-ui/Badge";

type Agent = {
  id: string;
  name: string;
  vertical?: string;
  inbound_number?: string;
  provider: string;
  consent_required: boolean;
  created_at: string;
};

export default function AgentsList() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound" | "both">("inbound");

  async function load() {
    try {
      const r = await api<{ agents: Agent[] }>("/v1/agents");
      setAgents(r.agents || []);
    } catch {
      setAgents([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api("/v1/agents", {
      method: "POST",
      body: JSON.stringify({
        name,
        persona: { direction, objective: "" },
      }),
    });
    setName("");
    setCreating(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-text-muted mt-1">
            One per role. Inbound, outbound, or both.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New agent
        </Button>
      </div>

      {creating && (
        <Card>
          <CardBody>
            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border bg-surface"
                  placeholder="Front Desk"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Direction
                </label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-md border border-border bg-surface"
                >
                  <option value="inbound">Inbound only</option>
                  <option value="outbound">Outbound only</option>
                  <option value="both">Both</option>
                </select>
                {direction !== "inbound" && (
                  <p className="mt-2 text-xs text-text-muted">
                    Outbound agents require consent on file. This is locked on
                    and cannot be turned off.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" type="button" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {agents === null ? (
        <Skeleton className="h-32" />
      ) : agents.length === 0 ? (
        <EmptyState
          title="Create your first agent"
          description="Pick a template and place a real test call in under five minutes."
          cta={
            <Button onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New agent
            </Button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a) => (
            <Link
              key={a.id}
              to={`/agents/${a.id}`}
              className="bg-surface border border-border rounded-md shadow-card p-5 hover:bg-surface-2"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </span>
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-text-muted">{a.provider}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {a.consent_required && <Badge tone="success" dot>consent on</Badge>}
                {a.inbound_number && <Badge tone="info">{a.inbound_number}</Badge>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

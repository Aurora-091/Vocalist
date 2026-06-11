import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Bot, Trash2 } from "lucide-react";
import { listAgents } from "../lib/db";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { Button } from "../components/legacy-ui/Button";
import { EmptyState, Skeleton } from "../components/legacy-ui/States";
import { Badge } from "../components/legacy-ui/Badge";
import { AgentPresetPicker } from "../components/AgentPresetPicker";

type Agent = {
  id: string;
  name: string;
  vertical?: string;
  inbound_number?: string;
  provider: string;
  consent_required: boolean;
  sync_status?: string | null;
  created_at: string;
};

type CreateMode = "idle" | "preset" | "manual";

export default function AgentsList() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [mode, setMode] = useState<CreateMode>("idle");
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound" | "both">("inbound");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function load() {
    try {
      setAgents(await listAgents());
    } catch {
      setAgents([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/v1/agents", {
      name,
      persona: { direction, objective: "" },
      consent_required: direction !== "inbound",
    });
    setName("");
    setMode("idle");
    load();
  }

  async function createFromPreset(preset: any) {
    await api.post("/v1/agents", {
      name: preset.name,
      persona: {
        direction: preset.direction,
        objective: preset.persona?.objective || "",
        tone: preset.persona?.tone || "",
        system_prompt: preset.persona?.system_prompt || "",
        first_message: preset.persona?.first_message || "",
        guardrails: preset.persona?.guardrails || [],
        tools: preset.tools || [],
      },
      consent_required: preset.consent_required,
      provider: "elevenlabs",
    });
    setMode("idle");
    load();
  }

  async function deleteAgent(id: string) {
    setDeletingId(id);
    try {
      await supabase
        .from("agents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      setAgents((prev) => prev?.filter((a) => a.id !== id) ?? null);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
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
        <Button onClick={() => setMode("preset")}>
          <Plus className="w-4 h-4 mr-2" />
          New agent
        </Button>
      </div>

      {mode === "preset" && (
        <div className="bg-surface border border-border rounded-md shadow-card p-6">
          <AgentPresetPicker
            onSelect={createFromPreset}
            onSkip={() => setMode("manual")}
          />
        </div>
      )}

      {mode === "manual" && (
        <div className="bg-surface border border-border rounded-md shadow-card">
          <div className="px-6 py-4">
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
                <Button variant="ghost" type="button" onClick={() => setMode("idle")}>
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {agents === null ? (
        <Skeleton className="h-32" />
      ) : agents.length === 0 ? (
        <EmptyState
          title="Create your first agent"
          description="Pick a template and place a real test call in under five minutes."
          cta={
            <Button onClick={() => setMode("preset")}>
              <Plus className="w-4 h-4 mr-2" />
              New agent
            </Button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a) => (
            <div key={a.id} className="relative group">
              <Link
                to={`/agents/${a.id}`}
                className="block bg-surface border border-border rounded-md shadow-card p-5 hover:bg-surface-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-md bg-surface-2 border border-border text-text-muted flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-text-muted">{a.provider}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  {a.consent_required && <Badge tone="success" dot>consent on</Badge>}
                  {a.inbound_number && <Badge tone="info">{a.inbound_number}</Badge>}
                  {a.sync_status === "synced" && <Badge tone="success">Synced</Badge>}
                  {a.sync_status === "pending" && <Badge tone="warning">Pending</Badge>}
                  {a.sync_status === "failed" && <Badge tone="danger">Failed</Badge>}
                </div>
              </Link>

              {/* Delete controls */}
              {confirmId === a.id ? (
                <div className="absolute inset-0 bg-surface/95 rounded-md border border-danger/30 flex flex-col items-center justify-center gap-3 p-4">
                  <p className="text-sm font-medium text-center">Delete "{a.name}"?</p>
                  <p className="text-xs text-text-muted text-center">This cannot be undone.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={deletingId === a.id}
                      onClick={() => deleteAgent(a.id)}
                    >
                      {deletingId === a.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.preventDefault(); setConfirmId(a.id); }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                  aria-label="Delete agent"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

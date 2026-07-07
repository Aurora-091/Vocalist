import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Bot, Trash2, Copy } from "lucide-react";
import { listAgents, deleteAgent as deleteAgentDb } from "../lib/db";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useVertical } from "../lib/VerticalContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { AgentPresetPicker } from "../components/AgentPresetPicker";
import VoiceLibrary from "./VoiceLibrary";

type Agent = {
  id: string;
  name: string;
  vertical?: string;
  inbound_number?: string;
  provider: string;
  provider_agent_id?: string | null;
  consent_required: boolean;
  sync_status?: string | null;
  created_at: string;
};

type CreateMode = "idle" | "preset" | "manual";

export default function AgentsList() {
  usePageTitle("Agents");
  const { vertical } = useVertical();
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [mode, setMode] = useState<CreateMode>("idle");
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound" | "both">("inbound");
  const [voiceStep, setVoiceStep] = useState(false);
  const [pendingVoiceId, setPendingVoiceId] = useState<string>("");
  const [pendingVoiceName, setPendingVoiceName] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);

  async function load() {
    try {
      setAgents(await listAgents());
    } catch {
      toast.error("Failed to load agents");
      setAgents([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function cancelCreate() {
    setMode("idle");
    setName("");
    setDirection("inbound");
    setVoiceStep(false);
    setPendingVoiceId("");
    setPendingVoiceName("");
  }

  async function submitCreate(voiceId?: string) {
    await api.post("/v1/agents", {
      name,
      persona: { direction, objective: "" },
      voice_id: voiceId || undefined,
      consent_required: direction !== "inbound",
    });
    cancelCreate();
    load();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setVoiceStep(true);
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
      voice_id: preset.overrideVoiceId || preset.voice_id || undefined,
      consent_required: preset.consent_required,
      provider: "elevenlabs",
    });
    setMode("idle");
    load();
  }

  async function deleteAgent(id: string) {
    setDeletingId(id);
    try {
      await deleteAgentDb(id);
      setAgents((prev) => prev?.filter((a) => a.id !== id) ?? null);
    } catch {
      toast.error("Failed to delete agent");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  async function cloneAgent(id: string, agentName: string) {
    setCloningId(id);
    try {
      await api.post(`/v1/agents/${id}/clone`, {});
      toast.success(`"${agentName}" duplicated.`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to duplicate agent.");
    } finally {
      setCloningId(null);
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
            verticalKey={vertical || undefined}
            showAllVerticals={true}
            onSelect={createFromPreset}
            onSkip={() => setMode("manual")}
          />
        </div>
      )}

      {mode === "manual" && (
        <div className="bg-surface border border-border rounded-md shadow-card">
          <div className="px-6 py-4">
            {!voiceStep ? (
              <form onSubmit={create} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-border bg-surface"
                    placeholder="Front Desk"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Direction</label>
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
                      Outbound agents require consent on file. This is locked on and cannot be turned off.
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" type="button" onClick={cancelCreate}>Cancel</Button>
                  <Button type="submit">Next: Choose voice</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Choose a voice <span className="text-text-muted font-normal">(optional)</span></div>
                    <p className="text-xs text-text-muted mt-0.5">Skip to use the default voice — you can change it later.</p>
                  </div>
                  {pendingVoiceName && (
                    <span className="text-xs text-success font-medium">{pendingVoiceName} selected</span>
                  )}
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  <VoiceLibrary
                    onSelect={(voiceId, voiceName) => {
                      setPendingVoiceId(voiceId);
                      setPendingVoiceName(voiceName);
                    }}
                    selectedVoiceId={pendingVoiceId}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" type="button" onClick={() => setVoiceStep(false)}>Back</Button>
                  <Button variant="ghost" type="button" onClick={() => submitCreate()}>
                    Skip
                  </Button>
                  <Button
                    type="button"
                    onClick={() => submitCreate(pendingVoiceId)}
                    disabled={!pendingVoiceId}
                  >
                    Create agent
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {agents === null ? (
        <Skeleton className="h-32" />
      ) : agents.length === 0 ? (
        <Empty className="bg-card border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Bot /></EmptyMedia>
            <EmptyTitle>Create your first agent</EmptyTitle>
            <EmptyDescription>Pick a template and place a real test call in under five minutes.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setMode("preset")}>
              <Plus className="w-4 h-4 mr-2" />
              New agent
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a) => {
            const isActive = a.sync_status === "synced" || !!a.provider_agent_id;
            const isFailed = a.sync_status === "failed";
            return (
            <div key={a.id} className="relative group">
              <Link
                to={`/agents/${a.id}`}
                className={`block bg-surface border border-border rounded-md shadow-card p-5 hover:bg-surface-2 transition-colors ${!isActive && !isFailed ? "opacity-75" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-md bg-surface-2 border border-border text-text-muted flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{a.name}</span>
                      <span
                        className={`shrink-0 w-2 h-2 rounded-full ${
                          isFailed ? "bg-danger" : isActive ? "bg-success" : "bg-text-muted/40"
                        }`}
                        title={isFailed ? "Sync failed" : isActive ? "Active" : "Not deployed"}
                      />
                    </div>
                    <div className="text-xs text-text-muted">
                      {isFailed ? "Sync failed" : isActive ? a.provider : "Not deployed"}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  {a.consent_required && (
                    <Badge variant="secondary" className="bg-success/15 text-success">
                      <span className="size-1.5 rounded-full bg-success mr-1" />consent on
                    </Badge>
                  )}
                  {a.inbound_number && (
                    <Badge variant="secondary" className="bg-info/15 text-info">{a.inbound_number}</Badge>
                  )}
                </div>
              </Link>

              {/* Card action buttons (visible on hover) */}
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.preventDefault(); cloneAgent(a.id, a.name); }}
                  disabled={cloningId === a.id}
                  className="p-1.5 rounded text-text-muted hover:text-text hover:bg-surface-2 transition-all disabled:opacity-50"
                  aria-label="Duplicate agent"
                  title="Duplicate"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); setConfirmId(a.id); }}
                  className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                  aria-label="Delete agent"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Delete confirmation overlay */}
              {confirmId === a.id && (
                <div className="absolute inset-0 bg-surface/95 rounded-md border border-danger/30 flex flex-col items-center justify-center gap-3 p-4 z-10">
                  <p className="text-sm font-medium text-center">Delete "{a.name}"?</p>
                  <p className="text-xs text-text-muted text-center">This cannot be undone.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deletingId === a.id}
                      onClick={() => deleteAgent(a.id)}
                    >
                      {deletingId === a.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )})}

          {/* New from template tile */}
          <button
            onClick={() => setMode("preset")}
            className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-5 text-text-muted hover:text-text hover:border-foreground/20 hover:bg-surface-2 transition-all cursor-pointer min-h-[120px]"
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm font-medium">New from template</span>
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { X, RotateCcw, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

type HistoryEntry = {
  persona: {
    objective?: string;
    tone?: string;
    guardrails?: string[] | string;
    identity?: string;
    first_message?: string;
    opening_message?: string;
  };
  saved_at: string;
};

type Props = {
  agentId: string;
  onRestore: () => void;
  onClose: () => void;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function PersonaDiff({ entry }: { entry: HistoryEntry }) {
  const p = entry.persona;
  const guardrailsText = Array.isArray(p.guardrails)
    ? p.guardrails.join("\n")
    : p.guardrails || "";
  const firstMessage = p.first_message || p.opening_message || "";

  const fields: { label: string; value: string }[] = [
    { label: "Objective", value: p.objective || "" },
    { label: "Tone", value: p.tone || "" },
    { label: "Opening message", value: firstMessage },
    { label: "Identity", value: p.identity || "" },
    { label: "Guardrails", value: guardrailsText },
  ].filter((f) => f.value.trim());

  if (fields.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Empty persona snapshot.</p>;
  }

  return (
    <div className="space-y-2">
      {fields.map((f) => (
        <div key={f.label}>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-0.5">
            {f.label}
          </p>
          <p className="text-xs text-foreground whitespace-pre-wrap line-clamp-3">{f.value}</p>
        </div>
      ))}
    </div>
  );
}

export function PromptHistoryDrawer({ agentId, onRestore, onClose }: Props) {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  useEffect(() => {
    api.get<{ history: HistoryEntry[] }>(`/v1/agents/${agentId}/history`)
      .then((res) => setHistory(res.history))
      .catch(() => setHistory([]));
  }, [agentId]);

  async function handleRestore(index: number) {
    setRestoring(index);
    try {
      await api.post(`/v1/agents/${agentId}/restore`, { index });
      toast.success("Persona restored.");
      onRestore();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Restore failed.");
    } finally {
      setRestoring(null);
      setConfirmIndex(null);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <aside className="w-full max-w-md bg-background border-l border-border h-full flex flex-col shadow-xl">
        <div className="h-14 flex items-center justify-between px-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Prompt history</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-3">
            {history === null ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">No history yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Each save creates a snapshot you can restore from.
                </p>
              </div>
            ) : (
              history.map((entry, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        v{history.length - i}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(entry.saved_at)}
                      </span>
                      <span className="text-[10px] text-muted-foreground opacity-60">
                        {new Date(entry.saved_at).toLocaleString(undefined, {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {confirmIndex === i ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setConfirmIndex(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={restoring === i}
                          onClick={() => handleRestore(i)}
                        >
                          {restoring === i ? "Restoring…" : "Confirm"}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => setConfirmIndex(i)}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </Button>
                    )}
                  </div>
                  <PersonaDiff entry={entry} />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Phone, X } from "lucide-react";
import { listCalls, getCall } from "../lib/db";
import { Badge } from "../components/legacy-ui/Badge";
import { EmptyState, Skeleton } from "../components/legacy-ui/States";

type Call = {
  id: string;
  direction: "inbound" | "outbound";
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
  cost_usd: number | null;
  recording_url: string | null;
  provider: string;
  transcript: any;
};

const STATUS_TONE: Record<string, "success" | "info" | "neutral" | "warning" | "danger"> = {
  completed: "success",
  failed: "danger",
  busy: "warning",
  no_answer: "warning",
  voicemail: "info",
  ringing: "info",
  in_progress: "info",
  queued: "neutral",
};

export default function Calls() {
  const [calls, setCalls] = useState<Call[] | null>(null);
  const [filter, setFilter] = useState<"" | "inbound" | "outbound">("");
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    try {
      setCalls(await listCalls({ direction: filter || undefined, limit: 50 }));
    } catch {
      setCalls([]);
    }
  }

  useEffect(() => {
    load();
  }, [filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
        <p className="text-sm text-text-muted mt-1">
          Every call. Searchable. Recording, transcript, and outcome on each.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <FilterChip active={filter === ""} onClick={() => setFilter("")}>
          All
        </FilterChip>
        <FilterChip active={filter === "inbound"} onClick={() => setFilter("inbound")}>
          Inbound
        </FilterChip>
        <FilterChip
          active={filter === "outbound"}
          onClick={() => setFilter("outbound")}
        >
          Outbound
        </FilterChip>
      </div>

      {calls === null ? (
        <Skeleton className="h-64" />
      ) : calls.length === 0 ? (
        <EmptyState
          title="No calls yet"
          description="Place a test call from any agent to see it here."
        />
      ) : (
        <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-muted">
              <tr>
                <Th>When</Th>
                <Th>Direction</Th>
                <Th>Status</Th>
                <Th>Duration</Th>
                <Th>Cost</Th>
                <Th>Provider</Th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-border hover:bg-surface-2 cursor-pointer"
                  onClick={() => setSelected(c.id)}
                >
                  <Td>
                    {c.started_at
                      ? new Date(c.started_at).toLocaleString()
                      : "—"}
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-text-muted" />
                      {c.direction}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[c.status] || "neutral"}>
                      {c.status}
                    </Badge>
                  </Td>
                  <Td className="font-mono">
                    {c.duration_sec != null ? `${c.duration_sec}s` : "—"}
                  </Td>
                  <Td className="font-mono">
                    {c.cost_usd != null ? `$${Number(c.cost_usd).toFixed(2)}` : "—"}
                  </Td>
                  <Td className="text-text-muted">{c.provider}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <CallDrawer id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-8 rounded-full text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-white"
          : "bg-surface border border-border text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 text-xs uppercase tracking-widest font-medium">
      {children}
    </th>
  );
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function CallDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [call, setCall] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await getCall(id);
        setCall(c);
      } catch {
        setCall(null);
      }
    })();
  }, [id]);

  const transcript = call?.transcript || [];

  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="flex-1 bg-black/40"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <aside className="w-full max-w-xl bg-bg border-l border-border h-full overflow-y-auto">
        <div className="h-14 flex items-center justify-between px-5 border-b border-border bg-surface">
          <div className="font-medium">Call detail</div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {!call ? (
            <Skeleton className="h-32" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Direction" value={call.direction} />
                <Field label="Status" value={call.status} />
                <Field
                  label="Started"
                  value={
                    call.started_at
                      ? new Date(call.started_at).toLocaleString()
                      : "—"
                  }
                />
                <Field
                  label="Duration"
                  value={
                    call.duration_sec != null ? `${call.duration_sec}s` : "—"
                  }
                />
                <Field
                  label="Cost"
                  value={
                    call.cost_usd != null
                      ? `$${Number(call.cost_usd).toFixed(2)}`
                      : "—"
                  }
                />
                <Field label="Provider" value={call.provider} />
              </div>

              {call.recording_url && (
                <div>
                  <div className="text-xs uppercase tracking-widest text-text-muted mb-2">
                    Recording
                  </div>
                  <audio src={call.recording_url} controls className="w-full" />
                </div>
              )}

              <div>
                <div className="text-xs uppercase tracking-widest text-text-muted mb-2">
                  Transcript
                </div>
                {!Array.isArray(transcript) || transcript.length === 0 ? (
                  <div className="text-sm text-text-muted">No transcript yet.</div>
                ) : (
                  <div className="space-y-3">
                    {transcript.map((t: any, i: number) => (
                      <div key={i} className="text-sm">
                        <div className="text-xs uppercase tracking-widest text-text-muted">
                          {t.role || t.speaker || "agent"}
                        </div>
                        <div className="mt-1">{t.text || t.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-text-muted">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

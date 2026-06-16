import { useEffect, useRef, useState } from "react";
import { Phone, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { listCalls, getCall } from "../lib/db";
import { Badge } from "../components/legacy-ui/Badge";
import { EmptyState, Skeleton } from "../components/legacy-ui/States";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

type SortField = "started_at" | "duration_sec" | "cost_usd";
type SortDir = "asc" | "desc";

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
  const [sortField, setSortField] = useState<SortField>("started_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const sorted = calls
    ? [...calls].sort((a, b) => {
        let av: any = a[sortField];
        let bv: any = b[sortField];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "string") av = new Date(av).getTime();
        if (typeof bv === "string") bv = new Date(bv).getTime();
        return sortDir === "asc" ? av - bv : bv - av;
      })
    : null;

  const ariaSort = (field: SortField): "ascending" | "descending" | "none" =>
    sortField === field ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
        <p className="text-sm text-text-muted mt-1" id="calls-desc">
          Every call. Searchable. Recording, transcript, and outcome on each.
        </p>
      </div>

      <div role="group" aria-label="Filter calls by direction" className="flex items-center gap-2">
        <FilterChip active={filter === ""} onClick={() => setFilter("")}>All</FilterChip>
        <FilterChip active={filter === "inbound"} onClick={() => setFilter("inbound")}>Inbound</FilterChip>
        <FilterChip active={filter === "outbound"} onClick={() => setFilter("outbound")}>Outbound</FilterChip>
      </div>

      {calls === null ? (
        <Skeleton className="h-64" aria-label="Loading calls" />
      ) : calls.length === 0 ? (
        <EmptyState
          title="No calls yet"
          description="Place a test call from any agent to see it here."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card border border-border rounded-md shadow-card overflow-hidden">
            <Table aria-describedby="calls-desc" aria-label="Call history">
              <TableCaption srOnly>
                {calls.length} call{calls.length !== 1 ? "s" : ""}
                {filter ? `, filtered to ${filter}` : ""}. Sorted by {sortField.replace(/_/g, " ")} {sortDir === "asc" ? "ascending" : "descending"}.
              </TableCaption>
              <TableHeader className="bg-muted">
                <TableRow>
                  <SortableTh
                    field="started_at"
                    current={sortField}
                    dir={sortDir}
                    ariaSort={ariaSort("started_at")}
                    onSort={toggleSort}
                  >
                    When
                  </SortableTh>
                  <Th>Direction</Th>
                  <Th>Status</Th>
                  <SortableTh
                    field="duration_sec"
                    current={sortField}
                    dir={sortDir}
                    ariaSort={ariaSort("duration_sec")}
                    onSort={toggleSort}
                  >
                    Duration
                  </SortableTh>
                  <SortableTh
                    field="cost_usd"
                    current={sortField}
                    dir={sortDir}
                    ariaSort={ariaSort("cost_usd")}
                    onSort={toggleSort}
                  >
                    Cost
                  </SortableTh>
                  <Th>Provider</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sorted || []).map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer focus-within:bg-muted/50"
                    onClick={() => setSelected(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(c.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View call details: ${c.direction}, ${c.status}, ${c.started_at ? new Date(c.started_at).toLocaleString() : "unknown time"}`}
                  >
                    <Td>
                      {c.started_at
                        ? new Date(c.started_at).toLocaleString()
                        : <span aria-label="Unknown time">—</span>}
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-3 text-muted-foreground" aria-hidden="true" />
                        {c.direction}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[c.status] || "neutral"}>
                        {c.status}
                      </Badge>
                    </Td>
                    <Td className="font-mono">
                      {c.duration_sec != null
                        ? <><span aria-hidden="true">{c.duration_sec}s</span><span className="sr-only">{c.duration_sec} seconds</span></>
                        : <span aria-label="Unknown duration">—</span>}
                    </Td>
                    <Td className="font-mono">
                      {c.cost_usd != null
                        ? `$${Number(c.cost_usd).toFixed(2)}`
                        : <span aria-label="Unknown cost">—</span>}
                    </Td>
                    <Td className="text-muted-foreground">{c.provider}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card list */}
          <ul className="md:hidden space-y-3" aria-label="Call history">
            {(sorted || []).map((c) => (
              <li key={c.id}>
                <button
                  className="w-full text-left bg-surface border border-border rounded-md shadow-card p-4 active:bg-surface-2 hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                  onClick={() => setSelected(c.id)}
                  aria-label={`View call: ${c.direction}, ${c.status}, ${c.started_at ? new Date(c.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "unknown time"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <Phone className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                      {c.direction === "inbound" ? "Inbound" : "Outbound"}
                    </span>
                    <Badge tone={STATUS_TONE[c.status] || "neutral"}>
                      {c.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>
                      {c.started_at
                        ? new Date(c.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                        : "—"}
                    </span>
                    <div className="flex items-center gap-3 font-mono" aria-label="Duration and cost">
                      {c.duration_sec != null && <span><span className="sr-only">Duration: </span>{c.duration_sec}s</span>}
                      {c.cost_usd != null && <span><span className="sr-only">Cost: </span>${Number(c.cost_usd).toFixed(2)}</span>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="text-xs text-text-muted text-right" aria-live="polite" aria-atomic="true">
            {calls.length} call{calls.length !== 1 ? "s" : ""}
          </div>
        </>
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
      aria-pressed={active}
      className={`px-3 h-8 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-surface border border-border text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <TableHead scope="col" className="text-xs uppercase tracking-widest font-medium">
      {children}
    </TableHead>
  );
}

function SortableTh({
  children,
  field,
  current,
  dir,
  ariaSort,
  onSort,
}: {
  children: React.ReactNode;
  field: SortField;
  current: SortField;
  dir: SortDir;
  ariaSort: "ascending" | "descending" | "none";
  onSort: (f: SortField) => void;
}) {
  const isActive = current === field;
  const Icon = isActive ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead
      scope="col"
      aria-sort={ariaSort}
      className="text-xs uppercase tracking-widest font-medium"
    >
      <button
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline"
        aria-label={`Sort by ${String(children)} ${isActive && dir === "asc" ? "descending" : "ascending"}`}
      >
        {children}
        <Icon className={cn("size-3", isActive ? "text-foreground" : "opacity-40")} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <TableCell className={className}>{children}</TableCell>;
}

function CallDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [call, setCall] = useState<any>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

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

  // Trap focus inside drawer and restore on close
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [onClose]);

  const transcript = call?.transcript || [];

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Call detail">
      <div
        className="flex-1 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="w-full max-w-xl bg-bg border-l border-border h-full overflow-y-auto">
        <div className="h-14 flex items-center justify-between px-5 border-b border-border bg-surface">
          <div className="font-medium" id="drawer-title">Call detail</div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border rounded"
            aria-label="Close call detail"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {!call ? (
            <Skeleton className="h-32" aria-label="Loading call detail" />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Direction" value={call.direction} />
                <Field label="Status" value={call.status} />
                <Field
                  label="Started"
                  value={call.started_at ? new Date(call.started_at).toLocaleString() : "—"}
                />
                <Field
                  label="Duration"
                  value={call.duration_sec != null ? `${call.duration_sec} seconds` : "—"}
                />
                <Field
                  label="Cost"
                  value={call.cost_usd != null ? `$${Number(call.cost_usd).toFixed(2)}` : "—"}
                />
                <Field label="Provider" value={call.provider} />
              </dl>

              {call.recording_url && (
                <section aria-label="Call recording">
                  <div className="text-xs uppercase tracking-widest text-text-muted mb-2">
                    Recording
                  </div>
                  <audio src={call.recording_url} controls className="w-full" aria-label="Call recording audio" />
                </section>
              )}

              <section aria-label="Call transcript">
                <div className="text-xs uppercase tracking-widest text-text-muted mb-2">
                  Transcript
                </div>
                {!Array.isArray(transcript) || transcript.length === 0 ? (
                  <div className="text-sm text-text-muted">No transcript yet.</div>
                ) : (
                  <ol className="space-y-3 list-none">
                    {transcript.map((t: any, i: number) => {
                      const speaker = t.role || t.speaker || "agent";
                      return (
                        <li key={i} className="text-sm">
                          <div
                            className="text-xs uppercase tracking-widest text-text-muted"
                            aria-label={`Speaker: ${speaker}`}
                          >
                            {speaker}
                          </div>
                          <div className="mt-1">{t.text || t.content}</div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
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
      <dt className="text-xs uppercase tracking-widest text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

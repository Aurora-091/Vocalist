import { useEffect, useState } from "react";
import {
  Phone,
  RefreshCw,
  Download,
  Copy,
  Check,
  DollarSign,
  Clock,
  TrendingUp,
  ChartBar as BarChart2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { listCalls, getCallsSummary, getCall, listAgents } from "../lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Agent = { id: string; name: string };
type CallRow = {
  id: string;
  agent_id: string;
  campaign_id: string | null;
  direction: string;
  status: string;
  provider: string;
  provider_call_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
  cost_usd: number | null;
  hangup_by: string | null;
  recording_url: string | null;
  transcript: any;
  created_at: string;
  agents: { name: string };
};

type Summary = {
  totalCost: number;
  totalDuration: number;
  avgCost: number;
  avgDuration: number;
  count: number;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  failed: "destructive",
  busy: "secondary",
  no_answer: "secondary",
  voicemail: "outline",
  in_progress: "outline",
  queued: "outline",
};

const PAGE_SIZES = [10, 20, 50];

export default function Calls() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [calls, setCalls] = useState<CallRow[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [agentId, setAgentId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Detail drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    listAgents().then(setAgents).catch(() => setAgents([]));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const filterOpts = {
        agent_id: agentId || undefined,
        direction: directionFilter || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom ? `${dateFrom}T00:00:00Z` : undefined,
        date_to: dateTo ? `${dateTo}T23:59:59Z` : undefined,
      };
      const [callsResult, summaryResult] = await Promise.all([
        listCalls({ ...filterOpts, limit: pageSize, offset: page * pageSize }),
        getCallsSummary(filterOpts),
      ]);
      setCalls(callsResult.data as CallRow[]);
      setTotalCount(callsResult.count);
      setSummary(summaryResult);
    } catch {
      setCalls([]);
      setTotalCount(0);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [agentId, statusFilter, directionFilter, dateFrom, dateTo, page, pageSize]);

  function resetFilters() {
    setAgentId("");
    setStatusFilter("");
    setDirectionFilter("");
    setPage(0);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor every conversation. Filter by agent, date, or status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" disabled={!calls || calls.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={agentId || "__all__"} onValueChange={(v) => { setAgentId(v === "__all__" ? "" : v); setPage(0); }}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
          className="w-[150px]"
        />
        <span className="text-muted-foreground text-sm">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          className="w-[150px]"
        />

        <Select value={statusFilter || "__all__"} onValueChange={(v) => { setStatusFilter(v === "__all__" ? "" : v); setPage(0); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="no_answer">No Answer</SelectItem>
            <SelectItem value="voicemail">Voicemail</SelectItem>
          </SelectContent>
        </Select>

        <Select value={directionFilter || "__all__"} onValueChange={(v) => { setDirectionFilter(v === "__all__" ? "" : v); setPage(0); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Call type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Cost"
          value={summary ? `$${summary.totalCost.toFixed(2)}` : null}
          sub="Campaign spend"
        />
        <StatCard
          icon={Clock}
          label="Total Duration"
          value={summary ? `${summary.totalDuration.toFixed(1)}s` : null}
          sub="Talk time"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Cost"
          value={summary ? `$${summary.avgCost.toFixed(2)}` : null}
          sub="per call"
        />
        <StatCard
          icon={BarChart2}
          label="Avg Duration"
          value={summary ? `${summary.avgDuration.toFixed(1)}s` : null}
          sub="per call"
        />
      </div>

      {/* Count badge */}
      {summary && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {totalCount} call{totalCount !== 1 ? "s" : ""} found
          </Badge>
        </div>
      )}

      {/* Table */}
      {calls === null || loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : calls.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-lg bg-card">
          <Phone className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No calls match your filters.</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={resetFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-medium">Execution ID</TableHead>
                    <TableHead className="text-xs font-medium">Agent</TableHead>
                    <TableHead className="text-xs font-medium">Call Type</TableHead>
                    <TableHead className="text-xs font-medium">Duration</TableHead>
                    <TableHead className="text-xs font-medium">Hangup By</TableHead>
                    <TableHead className="text-xs font-medium">Initiated At</TableHead>
                    <TableHead className="text-xs font-medium">Cost</TableHead>
                    <TableHead className="text-xs font-medium">Status</TableHead>
                    <TableHead className="text-xs font-medium">Conversation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setSelectedId(c.id)}
                    >
                      <TableCell className="font-mono text-xs">
                        <CopyableId id={c.id} />
                      </TableCell>
                      <TableCell className="text-sm">{c.agents?.name || "—"}</TableCell>
                      <TableCell className="text-sm">
                        <span className="capitalize">{c.provider} {c.direction}</span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {c.duration_sec != null ? c.duration_sec : "—"}
                      </TableCell>
                      <TableCell className="text-sm capitalize">
                        {c.hangup_by || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.started_at
                          ? new Date(c.started_at).toLocaleString(undefined, {
                              month: "short",
                              day: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {c.cost_usd != null ? `$${Number(c.cost_usd).toFixed(3)}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[c.status] || "outline"} className="capitalize text-xs">
                          {c.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.recording_url || c.transcript ? (
                          <span className="text-xs text-primary">Recordings</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground mr-2">
                Page {page + 1} of {totalPages}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(0)}>
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Detail drawer */}
      {selectedId && <CallDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Icon className="h-3.5 w-3.5" />
          <span className="uppercase tracking-wide font-medium">{label}</span>
        </div>
        {value === null ? (
          <Skeleton className="h-7 w-20 mt-1" />
        ) : (
          <div className="text-2xl font-bold font-mono tracking-tight">{value}</div>
        )}
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  );
}

function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const short = id.slice(0, 6) + "...";

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>{short}</span>
      <button
        onClick={handleCopy}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Copy execution ID"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

function CallDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [call, setCall] = useState<any>(null);

  useEffect(() => {
    getCall(id).then(setCall).catch(() => setCall(null));
  }, [id]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const transcript = call?.transcript || [];

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Call detail">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside className="w-full max-w-xl bg-background border-l border-border h-full overflow-y-auto shadow-xl">
        <div className="h-14 flex items-center justify-between px-5 border-b border-border">
          <span className="font-medium text-sm">Call Detail</span>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-5 space-y-5">
          {!call ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Direction" value={call.direction} />
                <Field label="Status" value={call.status} />
                <Field label="Provider" value={call.provider} />
                <Field label="Hangup By" value={call.hangup_by || "—"} />
                <Field
                  label="Started"
                  value={call.started_at ? new Date(call.started_at).toLocaleString() : "—"}
                />
                <Field
                  label="Duration"
                  value={call.duration_sec != null ? `${call.duration_sec}s` : "—"}
                />
                <Field
                  label="Cost"
                  value={call.cost_usd != null ? `$${Number(call.cost_usd).toFixed(3)}` : "—"}
                />
                <Field label="Execution ID" value={call.id} />
              </dl>

              {call.recording_url && (
                <section>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 font-medium">
                    Recording
                  </div>
                  <audio src={call.recording_url} controls className="w-full" />
                </section>
              )}

              <section>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 font-medium">
                  Transcript
                </div>
                {!Array.isArray(transcript) || transcript.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transcript available.</p>
                ) : (
                  <div className="space-y-3">
                    {transcript.map((t: any, i: number) => (
                      <div key={i} className="text-sm">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground">
                          {t.role || t.speaker || "agent"}
                        </span>
                        <p className="mt-0.5">{t.text || t.content}</p>
                      </div>
                    ))}
                  </div>
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
      <dt className="text-xs uppercase tracking-widest text-muted-foreground font-medium">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}

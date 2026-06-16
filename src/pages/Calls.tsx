import { useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MessageSquare,
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
  Phone,
  MessageCircle,
  Mail,
  Globe,
} from "lucide-react";
import { useState } from "react";
import { listCalls, getCallsSummary, getCall, listAgents } from "../lib/db";
import { StatCard } from "@/components/legacy-ui/StatCard";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Agent = { id: string; name: string };
type ConversationRow = {
  id: string;
  agent_id: string;
  campaign_id: string | null;
  channel: string;
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
  outcome: any;
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

const CHANNEL_ICON: Record<string, React.ElementType> = {
  voice: Phone,
  sms: MessageCircle,
  chat: MessageSquare,
  email: Mail,
  whatsapp: Globe,
};

const PAGE_SIZES = [10, 20, 50];

function defaultDateFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

export default function Conversations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter state from URL
  const agentId = searchParams.get("agent") || "";
  const statusFilter = searchParams.get("status") || "";
  const directionFilter = searchParams.get("direction") || "";
  const dateFrom = searchParams.get("from") || defaultDateFrom();
  const dateTo = searchParams.get("to") || new Date().toISOString().split("T")[0];
  const page = Number(searchParams.get("page") || "0");
  const pageSize = Number(searchParams.get("size") || "20");

  function setParam(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!value || value === "__all__") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      if (key !== "page") next.delete("page");
      return next;
    });
  }

  function setPage(p: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p === 0) next.delete("page");
      else next.set("page", String(p));
      return next;
    });
  }

  function setPageSize(s: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("size", String(s));
      next.delete("page");
      return next;
    });
  }

  function resetFilters() {
    setSearchParams({});
  }

  useEffect(() => {
    listAgents().then(setAgents).catch(() => setAgents([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filterOpts = {
        agent_id: agentId || undefined,
        direction: directionFilter || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom ? `${dateFrom}T00:00:00Z` : undefined,
        date_to: dateTo ? `${dateTo}T23:59:59Z` : undefined,
      };
      const [result, summaryResult] = await Promise.all([
        listCalls({ ...filterOpts, limit: pageSize, offset: page * pageSize }),
        getCallsSummary(filterOpts),
      ]);
      setConversations(result.data as ConversationRow[]);
      setTotalCount(result.count);
      setSummary(summaryResult);
    } catch {
      setConversations([]);
      setTotalCount(0);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [agentId, statusFilter, directionFilter, dateFrom, dateTo, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every conversation across all channels. Filter, inspect, and replay.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" disabled={!conversations || conversations.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={agentId || "__all__"} onValueChange={(v) => setParam("agent", v)}>
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
          onChange={(e) => setParam("from", e.target.value)}
          className="w-[150px]"
        />
        <span className="text-muted-foreground text-sm">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setParam("to", e.target.value)}
          className="w-[150px]"
        />

        <Select value={statusFilter || "__all__"} onValueChange={(v) => setParam("status", v)}>
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

        <Select value={directionFilter || "__all__"} onValueChange={(v) => setParam("direction", v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All directions</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Total Cost"
          value={summary ? `$${summary.totalCost.toFixed(2)}` : "—"}
          hint="Campaign spend"
          loading={loading && summary === null}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Total Duration"
          value={summary ? `${summary.totalDuration.toFixed(0)}s` : "—"}
          hint="Talk time"
          loading={loading && summary === null}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Avg Cost"
          value={summary ? `$${summary.avgCost.toFixed(2)}` : "—"}
          hint="Per conversation"
          loading={loading && summary === null}
        />
        <StatCard
          icon={<BarChart2 className="h-4 w-4" />}
          label="Avg Duration"
          value={summary ? `${summary.avgDuration.toFixed(0)}s` : "—"}
          hint="Per conversation"
          loading={loading && summary === null}
        />
      </div>

      {/* Count */}
      {!loading && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {totalCount} conversation{totalCount !== 1 ? "s" : ""}
          </Badge>
        </div>
      )}

      {/* Table */}
      {conversations === null || (loading && conversations === null) ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 border border-border rounded-lg bg-card">
          <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No conversations match your filters.</p>
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
                    <TableHead className="text-xs font-medium">ID</TableHead>
                    <TableHead className="text-xs font-medium">Channel</TableHead>
                    <TableHead className="text-xs font-medium">Agent</TableHead>
                    <TableHead className="text-xs font-medium">Direction</TableHead>
                    <TableHead className="text-xs font-medium">Duration</TableHead>
                    <TableHead className="text-xs font-medium">Hangup By</TableHead>
                    <TableHead className="text-xs font-medium">Initiated At</TableHead>
                    <TableHead className="text-xs font-medium">Cost</TableHead>
                    <TableHead className="text-xs font-medium">Status</TableHead>
                    <TableHead className="text-xs font-medium">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversations.map((c) => {
                    const ChannelIcon = CHANNEL_ICON[c.channel || "voice"] || Phone;
                    return (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setSelectedId(c.id)}
                      >
                        <TableCell className="font-mono text-xs">
                          <CopyableId id={c.id} />
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <ChannelIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="capitalize">{c.channel || "voice"}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{c.agents?.name || "—"}</TableCell>
                        <TableCell className="text-sm capitalize">{c.direction}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {c.duration_sec != null ? `${c.duration_sec}s` : "—"}
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
                            <span className="text-xs text-primary font-medium">View</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
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
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(0)} aria-label="First page">
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} aria-label="Next page">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} aria-label="Last page">
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}

      {selectedId && (
        <ConversationDrawer id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>{id.slice(0, 7)}…</span>
      <button
        onClick={handleCopy}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Copy ID"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

function ConversationDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [conversation, setConversation] = useState<any>(null);

  useEffect(() => {
    getCall(id).then(setConversation).catch(() => setConversation(null));
  }, [id]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const transcript: any[] = Array.isArray(conversation?.transcript) ? conversation.transcript : [];
  const toolCalls = conversation?.outcome?.tool_calls || [];
  const analysis = conversation?.outcome;
  const dataCollection = analysis?.data_collection_results || analysis?.data_collection || null;
  const evalCriteria = analysis?.evaluation_criteria_results || analysis?.evaluation_criteria || null;
  const hasAnalysis = dataCollection || evalCriteria;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Conversation detail">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside className="w-full max-w-2xl bg-background border-l border-border h-full flex flex-col shadow-xl">
        {/* Drawer header */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">Conversation</span>
            {conversation && (
              <Badge variant="outline" className="text-xs font-mono">
                {conversation.id.slice(0, 8)}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        {!conversation ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="summary" className="flex-1 min-h-0 flex flex-col">
            <div className="px-5 pt-3 border-b border-border shrink-0">
              <TabsList variant="line" className="gap-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="recording">Recording</TabsTrigger>
                <TabsTrigger value="tool-calls">
                  Tool Calls
                  {toolCalls.length > 0 && (
                    <span className="ml-1 text-xs bg-muted rounded-full px-1.5 py-0.5">
                      {toolCalls.length}
                    </span>
                  )}
                </TabsTrigger>
                {hasAnalysis && (
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                )}
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-5">
                {/* Summary tab */}
                <TabsContent value="summary">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    <Field label="Channel" value={
                      <span className="capitalize">{conversation.channel || "voice"}</span>
                    } />
                    <Field label="Direction" value={
                      <span className="capitalize">{conversation.direction}</span>
                    } />
                    <Field label="Status" value={
                      <Badge variant={STATUS_VARIANT[conversation.status] || "outline"} className="capitalize text-xs">
                        {conversation.status.replace(/_/g, " ")}
                      </Badge>
                    } />
                    <Field label="Provider" value={conversation.provider} />
                    <Field label="Hangup By" value={
                      <span className="capitalize">{conversation.hangup_by || "—"}</span>
                    } />
                    <Field label="Started" value={
                      conversation.started_at
                        ? new Date(conversation.started_at).toLocaleString()
                        : "—"
                    } />
                    <Field label="Duration" value={
                      conversation.duration_sec != null
                        ? `${conversation.duration_sec}s`
                        : "—"
                    } />
                    <Field label="Cost" value={
                      conversation.cost_usd != null
                        ? `$${Number(conversation.cost_usd).toFixed(4)}`
                        : "—"
                    } />
                  </dl>
                </TabsContent>

                {/* Transcript tab */}
                <TabsContent value="transcript">
                  {transcript.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transcript available.</p>
                  ) : (
                    <div className="space-y-4">
                      {transcript.map((t: any, i: number) => {
                        const speaker = t.role || t.speaker || "agent";
                        const isAgent = speaker === "agent" || speaker === "assistant";
                        return (
                          <div
                            key={i}
                            className={cn(
                              "flex gap-3",
                              isAgent ? "flex-row" : "flex-row-reverse"
                            )}
                          >
                            <div
                              className={cn(
                                "flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium",
                                isAgent
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {isAgent ? "A" : "U"}
                            </div>
                            <div
                              className={cn(
                                "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                                isAgent
                                  ? "bg-muted text-foreground"
                                  : "bg-primary/10 text-foreground"
                              )}
                            >
                              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                                {speaker}
                              </p>
                              {t.text || t.content}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Recording tab */}
                <TabsContent value="recording">
                  {conversation.recording_url ? (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
                        Call Recording
                      </p>
                      <audio
                        src={conversation.recording_url}
                        controls
                        className="w-full"
                        aria-label="Call recording"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recording available.</p>
                  )}
                </TabsContent>

                {/* Tool Calls tab */}
                <TabsContent value="tool-calls">
                  {toolCalls.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tool calls were made during this conversation.</p>
                  ) : (
                    <div className="space-y-3">
                      {toolCalls.map((tc: any, i: number) => (
                        <div key={i} className="rounded-md border border-border p-3 text-sm">
                          <div className="font-mono text-xs text-primary mb-1">{tc.name || tc.tool}</div>
                          <pre className="text-xs text-muted-foreground overflow-x-auto">
                            {JSON.stringify(tc.args || tc.input || tc, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Analysis tab */}
                <TabsContent value="analysis">
                  {!hasAnalysis ? (
                    <p className="text-sm text-muted-foreground">No analysis data for this call.</p>
                  ) : (
                    <div className="space-y-6">
                      {dataCollection && (
                        <div>
                          <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
                            Extracted Data
                          </h4>
                          <div className="space-y-2">
                            {Object.entries(dataCollection).map(([key, val]: [string, any]) => {
                              const value = typeof val === "object" && val !== null ? val.value : val;
                              return (
                                <div key={key} className="flex items-baseline justify-between gap-4 py-2 border-b border-border last:border-0">
                                  <span className="text-sm font-medium text-foreground">
                                    {key.replace(/_/g, " ")}
                                  </span>
                                  <span className="text-sm text-muted-foreground text-right max-w-[60%]">
                                    {value === true ? "Yes" : value === false ? "No" : value || "—"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {evalCriteria && (
                        <div>
                          <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
                            Evaluation Criteria
                          </h4>
                          <div className="space-y-2">
                            {Object.entries(evalCriteria).map(([key, val]: [string, any]) => {
                              const result = typeof val === "object" && val !== null ? val.result : val;
                              const rationale = typeof val === "object" && val !== null ? val.rationale : null;
                              return (
                                <div key={key} className="py-2 border-b border-border last:border-0">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-sm font-medium text-foreground">
                                      {key.replace(/_/g, " ")}
                                    </span>
                                    <Badge
                                      variant={result === "success" ? "default" : result === "failure" ? "destructive" : "outline"}
                                      className="text-xs capitalize"
                                    >
                                      {result || "unknown"}
                                    </Badge>
                                  </div>
                                  {rationale && (
                                    <p className="text-xs text-muted-foreground mt-1">{rationale}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Raw tab */}
                <TabsContent value="raw">
                  <div className="rounded-md border border-border bg-muted/50 p-3">
                    <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(conversation, null, 2)}
                    </pre>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        )}
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

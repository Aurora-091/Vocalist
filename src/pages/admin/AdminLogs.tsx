import { useEffect, useState, useCallback, Fragment } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { type LogEntry, type PaginatedResult } from "../../lib/admin-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminLogs() {
  const [searchParams] = useSearchParams();
  const initialOrg = searchParams.get("org") || "";

  const [result, setResult] = useState<PaginatedResult<LogEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [orgId, setOrgId] = useState(initialOrg);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (severity) params.set("severity", severity);
      if (q) params.set("q", q);
      if (orgId) params.set("org_id", orgId);
      const res = await api.get<PaginatedResult<LogEntry>>(`/v1/admin/logs?${params}`);
      setResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, severity, q, orgId]);

  useEffect(() => { load(); }, [load]);

  async function handleResolveLog(id: string) {
    setResolvingId(id);
    try {
      await api.patch(`/v1/admin/logs/${id}/resolve`);
      toast.success("Error resolved");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve error");
    } finally {
      setResolvingId(null);
    }
  }

  const totalPages = result ? Math.ceil(result.total / result.limit) : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Logs</h1>

      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 border rounded-lg p-0.5 bg-muted/20">
            {[
              { value: "", label: "All" },
              { value: "error", label: "Errors" },
              { value: "resolved", label: "Resolved" },
            ].map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={severity === f.value ? "secondary" : "ghost"}
                onClick={() => { setSeverity(f.value); setPage(1); }}
                className="text-xs h-8 px-3"
              >
                {f.label}
              </Button>
            ))}
          </div>
          <Input
            placeholder="Org ID"
            value={orgId}
            onChange={(e) => { setOrgId(e.target.value); setPage(1); }}
            className="w-full sm:w-[180px] h-9"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Event</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !result && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {result?.data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No logs found</td></tr>
              )}
              {result?.data.map((log) => (
                <Fragment key={log.id}>
                  <tr
                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${expanded === log.id ? "bg-muted/25" : ""}`}
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">{log.source}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{log.event_type}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant={log.resolved_at ? "default" : "destructive"} className="text-xs">
                        {log.resolved_at ? "Resolved" : `Error (x${log.retry_count})`}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[300px] hidden lg:table-cell">
                      {log.error_message || "---"}
                    </td>
                  </tr>
                  {expanded === log.id && (
                    <tr className="bg-muted/10">
                      <td colSpan={5} className="px-6 py-4 border-t border-b border-border">
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                            <div>
                              <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Full Error Message</span>
                              <span className="font-mono text-foreground break-all">{log.error_message || "---"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Retry Count</span>
                              <span className="text-foreground">{log.retry_count}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Resolved At</span>
                              <span className="text-foreground">
                                {log.resolved_at ? new Date(log.resolved_at).toLocaleString() : "Unresolved"}
                              </span>
                            </div>
                          </div>
                          
                          {log.metadata && (
                            <div className="space-y-1">
                              <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider">Metadata</span>
                              <pre className="font-mono text-xs bg-muted rounded p-3 overflow-x-auto text-foreground max-w-full">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </div>
                          )}

                          {!log.resolved_at && (
                            <div className="flex justify-start pt-2">
                              <Button 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolveLog(log.id);
                                }}
                                disabled={resolvingId === log.id}
                              >
                                {resolvingId === log.id ? "Resolving..." : "Mark Resolved"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {result && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">{result.total} entries</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

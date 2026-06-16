import { useEffect, useState, useCallback } from "react";
import { adminApi, type LogEntry, type PaginatedResult } from "../../lib/admin-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminLogs() {
  const [result, setResult] = useState<PaginatedResult<LogEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listLogs({ page, severity });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [page, severity]);

  useEffect(() => { load(); }, [load]);

  const totalPages = result ? Math.ceil(result.total / result.limit) : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Logs</h1>

      <div className="flex gap-1">
        {[
          { value: "", label: "All" },
          { value: "error", label: "Errors" },
          { value: "resolved", label: "Resolved" },
        ].map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={severity === f.value ? "default" : "ghost"}
            onClick={() => { setSeverity(f.value); setPage(1); }}
            className="text-xs"
          >
            {f.label}
          </Button>
        ))}
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
                <tr
                  key={log.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
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

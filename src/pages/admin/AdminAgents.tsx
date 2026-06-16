import { useEffect, useState, useCallback } from "react";
import { Search } from "lucide-react";
import { adminApi, type AdminAgent, type PaginatedResult } from "../../lib/admin-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminAgents() {
  const [result, setResult] = useState<PaginatedResult<AdminAgent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listAgents({ page, q });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => { load(); }, [load]);

  const totalPages = result ? Math.ceil(result.total / result.limit) : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Agents</h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search agents..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Owner</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Provider</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Vertical</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !result && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {result?.data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No agents found</td></tr>
              )}
              {result?.data.map((agent) => (
                <tr key={agent.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{agent.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{agent.orgs?.name || "---"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <Badge variant="secondary" className="text-xs capitalize">{agent.provider}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize hidden lg:table-cell">{agent.vertical || "---"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{new Date(agent.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">{result.total} total agents</span>
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

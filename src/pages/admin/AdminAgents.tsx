import { useEffect, useState, useCallback, Fragment } from "react";
import { Search, Copy, Check, ExternalLink } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { adminApi, type AdminAgent, type PaginatedResult } from "../../lib/admin-api";
import { api } from "../../lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AdminAgents() {
  const [searchParams] = useSearchParams();
  const initialOrg = searchParams.get("org") || "";

  const [result, setResult] = useState<PaginatedResult<AdminAgent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [orgId, setOrgId] = useState(initialOrg);
  const [page, setPage] = useState(1);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, any>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (q) params.set("q", q);
      if (orgId) params.set("org_id", orgId);
      const res = await api.get<PaginatedResult<AdminAgent>>(`/v1/admin/agents?${params}`);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, q, orgId]);

  useEffect(() => { load(); }, [load]);

  const handleRowClick = async (agentId: string) => {
    if (expanded === agentId) {
      setExpanded(null);
      return;
    }
    setExpanded(agentId);
    if (!details[agentId]) {
      setDetailsLoading(prev => ({ ...prev, [agentId]: true }));
      try {
        const res = await adminApi.getAgentDetail(agentId);
        setDetails(prev => ({ ...prev, [agentId]: res }));
      } catch (err: any) {
        toast.error(err.message || "Failed to load agent details");
      } finally {
        setDetailsLoading(prev => ({ ...prev, [agentId]: false }));
      }
    }
  };

  const handleCopy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedId(txt);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPages = result ? Math.ceil(result.total / result.limit) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <h1 className="text-2xl font-semibold">Agents</h1>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="pl-9 h-9"
            />
          </div>
          <Input
            placeholder="Filter by Org ID..."
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
                <Fragment key={agent.id}>
                  <tr 
                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${expanded === agent.id ? "bg-muted/25" : ""}`}
                    onClick={() => handleRowClick(agent.id)}
                  >
                    <td className="px-4 py-3 font-medium">{agent.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{agent.orgs?.name || "---"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <Badge variant="secondary" className="text-xs capitalize">{agent.provider}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize hidden lg:table-cell">{agent.vertical || "---"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{new Date(agent.created_at).toLocaleDateString()}</td>
                  </tr>
                  {expanded === agent.id && (
                    <tr className="bg-muted/10">
                      <td colSpan={5} className="px-6 py-4 border-t border-b border-border">
                        {detailsLoading[agent.id] ? (
                          <div className="text-center text-xs text-muted-foreground py-2">
                            Loading details...
                          </div>
                        ) : details[agent.id] ? (
                          (() => {
                            const detail = details[agent.id];
                            return (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                                  <div>
                                    <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Agent ID</span>
                                    <div className="flex items-center gap-2">
                                      <code className="font-mono bg-muted px-2 py-1 rounded text-xs text-foreground break-all">
                                        {detail.id}
                                      </code>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopy(detail.id);
                                        }}
                                      >
                                        {copiedId === detail.id ? (
                                          <Check className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Configuration</span>
                                    <div className="space-y-1 text-xs text-foreground">
                                      <div><span className="text-muted-foreground">Provider:</span> <span className="capitalize">{detail.provider}</span></div>
                                      <div><span className="text-muted-foreground">Voice ID:</span> <code className="font-mono text-[10px]">{detail.voice_id || "None"}</code></div>
                                      <div><span className="text-muted-foreground">Vertical:</span> <span className="capitalize">{detail.vertical || "General"}</span></div>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Organization & Status</span>
                                    <div className="space-y-1 text-xs text-foreground">
                                      <div><span className="text-muted-foreground">Org Name:</span> {detail.orgs?.name || "---"}</div>
                                      <div><span className="text-muted-foreground">Status:</span> <span className="capitalize">{detail.status || "Active"}</span></div>
                                      <div><span className="text-muted-foreground">Created:</span> {new Date(detail.created_at).toLocaleString()}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-end justify-start md:justify-end">
                                    <a
                                      href={`/agents/${detail.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      View in Console
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="text-center text-xs text-destructive py-2">
                            Failed to load details.
                          </div>
                        )}
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

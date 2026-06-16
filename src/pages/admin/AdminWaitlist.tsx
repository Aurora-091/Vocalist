import { useEffect, useState, useCallback } from "react";
import { Search, Check, X, Download } from "lucide-react";
import { adminApi, type WaitlistEntry, type PaginatedResult } from "../../lib/admin-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-destructive/10 text-destructive",
};

export default function AdminWaitlist() {
  const [result, setResult] = useState<PaginatedResult<WaitlistEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listWaitlist({ page, q, status: statusFilter });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [page, q, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!result) return;
    if (selected.size === result.data.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(result.data.map((r) => r.id)));
    }
  }

  async function handleBulkAction(status: string) {
    if (!selected.size) return;
    await adminApi.bulkUpdateWaitlist([...selected], status);
    setSelected(new Set());
    load();
  }

  async function handleSingleAction(id: string, status: string) {
    await adminApi.updateWaitlistStatus(id, status);
    load();
  }

  function exportCsv() {
    if (!result?.data.length) return;
    const headers = ["Name", "Email", "Phone", "Source", "Status", "Date"];
    const rows = result.data.map((r) => [
      r.name || "", r.email, r.phone || "", r.source, r.status,
      new Date(r.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = result ? Math.ceil(result.total / result.limit) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Waitlist</h1>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("approved")}>
                <Check className="w-3.5 h-3.5 mr-1" /> Approve ({selected.size})
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("rejected")}>
                <X className="w-3.5 h-3.5 mr-1" /> Reject ({selected.size})
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {["all", "pending", "approved", "rejected"].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "ghost"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className="capitalize text-xs"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 w-10">
                  <Checkbox checked={result?.data.length ? selected.size === result.data.length : false} onCheckedChange={toggleAll} />
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Source</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !result && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {result?.data.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No entries found</td></tr>
              )}
              {result?.data.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Checkbox checked={selected.has(entry.id)} onCheckedChange={() => toggleSelect(entry.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium">{entry.name || "---"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.email}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{entry.phone || "---"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{entry.source}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={`text-xs capitalize ${STATUS_STYLES[entry.status] || ""}`}>
                      {entry.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {entry.status !== "approved" && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600" onClick={() => handleSingleAction(entry.id, "approved")}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {entry.status !== "rejected" && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => handleSingleAction(entry.id, "rejected")}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {(page - 1) * result.limit + 1}--{Math.min(page * result.limit, result.total)} of {result.total}
            </span>
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

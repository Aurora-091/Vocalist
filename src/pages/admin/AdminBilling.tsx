import { useEffect, useState, useCallback } from "react";
import { adminApi, type BillingEntry, type PaginatedResult } from "../../lib/admin-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminBilling() {
  const [result, setResult] = useState<PaginatedResult<BillingEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listBilling({ page });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = result ? Math.ceil(result.total / result.limit) : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Organization</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Stripe ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Renewal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !result && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {result?.data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No subscriptions found</td></tr>
              )}
              {result?.data.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{entry.orgs?.name || "---"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs capitalize">{entry.plan_id}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={entry.status === "active" ? "default" : "secondary"} className="text-xs capitalize">
                      {entry.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">
                    {entry.stripe_subscription_id || "---"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {entry.current_period_end ? new Date(entry.current_period_end).toLocaleDateString() : "---"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">{result.total} subscriptions</span>
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

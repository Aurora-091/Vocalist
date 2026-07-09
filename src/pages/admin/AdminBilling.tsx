import { useEffect, useState, useCallback, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, Check } from "lucide-react";
import { api } from "../../lib/api";
import { type BillingEntry, type PaginatedResult } from "../../lib/admin-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function AdminBilling() {
  const [searchParams] = useSearchParams();
  const initialOrg = searchParams.get("org") || "";

  const [result, setResult] = useState<PaginatedResult<BillingEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [orgId, setOrgId] = useState(initialOrg);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (orgId) params.set("org_id", orgId);
      const res = await api.get<PaginatedResult<BillingEntry>>(`/v1/admin/billing?${params}`);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, orgId]);

  useEffect(() => { load(); }, [load]);

  async function handleCancelSub(id: string) {
    setCancelingId(id);
    try {
      await api.post(`/v1/admin/billing/${id}/cancel`);
      toast.success("Subscription cancelled successfully");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel subscription");
    } finally {
      setCancelingId(null);
    }
  }

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
        <h1 className="text-2xl font-semibold">Billing</h1>
        <Input
          placeholder="Filter by Org ID..."
          value={orgId}
          onChange={(e) => { setOrgId(e.target.value); setPage(1); }}
          className="w-full md:w-[260px] h-9"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Organization</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Renewal</th>
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
                <Fragment key={entry.id}>
                  <tr 
                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${expanded === entry.id ? "bg-muted/25" : ""}`}
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  >
                    <td className="px-4 py-3 font-medium">{entry.orgs?.name || "---"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs capitalize">{entry.plan_id}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={entry.status === "active" ? "default" : "secondary"} className="text-xs capitalize">
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground font-mono">
                      {entry.monthly_amount !== undefined && entry.monthly_amount !== null 
                        ? `$${entry.monthly_amount}/mo` 
                        : "---"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.current_period_end ? new Date(entry.current_period_end).toLocaleDateString() : "---"}
                    </td>
                  </tr>
                  {expanded === entry.id && (
                    <tr className="bg-muted/10">
                      <td colSpan={5} className="px-6 py-4 border-t border-b border-border">
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                            <div>
                              <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Stripe Subscription ID</span>
                              {entry.stripe_subscription_id ? (
                                <div className="flex items-center gap-2">
                                  <code className="font-mono bg-muted px-2 py-1 rounded text-xs text-foreground break-all">
                                    {entry.stripe_subscription_id}
                                  </code>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopy(entry.stripe_subscription_id || "");
                                    }}
                                    aria-label="Copy Subscription ID"
                                  >
                                    {copiedId === entry.stripe_subscription_id ? (
                                      <Check className="h-3.5 w-3.5 text-success" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-foreground">---</span>
                              )}
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Period Dates</span>
                              <div className="space-y-1 text-xs text-foreground">
                                <div><span className="text-muted-foreground">Start:</span> {entry.period_start ? new Date(entry.period_start).toLocaleDateString() : "---"}</div>
                                <div><span className="text-muted-foreground">End:</span> {entry.period_end ? new Date(entry.period_end).toLocaleDateString() : "---"}</div>
                                <div><span className="text-muted-foreground">Created:</span> {new Date(entry.created_at).toLocaleDateString()}</div>
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wider mb-1">Usage This Month</span>
                              <span className="text-foreground font-mono">
                                {entry.usage_this_month != null
                                  ? `$${entry.usage_this_month.toFixed(2)}`
                                  : entry.usage != null
                                    ? String(entry.usage)
                                    : "---"}
                              </span>
                            </div>
                            <div className="flex items-end justify-start md:justify-end">
                              {entry.status === "active" && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={(e) => e.stopPropagation()}
                                      disabled={cancelingId === entry.id}
                                    >
                                      {cancelingId === entry.id ? "Cancelling..." : "Cancel Subscription"}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to cancel this Stripe subscription? This action will immediately update the subscription status on Stripe.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                        onClick={() => handleCancelSub(entry.id)}
                                      >
                                        Confirm
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
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

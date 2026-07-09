import { useEffect, useState, useCallback } from "react";
import { getOverview, getOutcomesData } from "../lib/db";
import { toast } from "sonner";
import { usePageTitle } from "../hooks/usePageTitle";
import { useVertical } from "../lib/VerticalContext";
import { formatMoney } from "../lib/format";
import { supabase } from "../lib/supabase";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ShoppingCart, Phone, Target } from "lucide-react";

const PLAYBOOK_LABELS: Record<string, string> = {
  cart_recovery: "Cart Recovery",
  cod_confirm: "COD Confirmation",
  feedback: "Post-delivery Feedback",
};

const PIPELINE_COLORS: Record<string, string> = {
  recovered: "bg-emerald-500",
  cancelled_converted: "bg-blue-400",
  pending: "bg-amber-400",
  dispatched: "bg-indigo-400",
  failed: "bg-red-400",
  cancelled: "bg-slate-400",
  no_answer: "bg-orange-400",
  busy: "bg-yellow-400",
};


function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  const w = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="capitalize">{label.replace(/_/g, " ")}</span>
        <span className="font-mono text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color || "bg-primary"}`}
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}

function MiniSparkline({ data }: { data: { date: string; total: number; completed: number }[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d) => {
        const h = Math.round((d.total / max) * 100);
        const ch = Math.round((d.completed / max) * 100);
        return (
          <div key={d.date} className="flex-1 flex flex-col justify-end gap-0.5 group relative">
            <div
              className="w-full bg-primary/20 rounded-sm"
              style={{ height: `${h}%` }}
            />
            <div
              className="w-full bg-primary rounded-sm absolute bottom-0"
              style={{ height: `${ch}%` }}
            />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border border-border text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {d.date.slice(5)}: {d.completed}/{d.total}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Outcomes() {
  const { t } = useVertical();
  usePageTitle("Results");
  const [overview, setOverview] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [o, d] = await Promise.all([getOverview(), getOutcomesData(30)]);
      setOverview(o || {});
      setData(d);
    } catch {
      toast.error("Failed to load results data");
      setOverview({});
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("outcomes-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls" },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const currency = data?.currency || "INR";
  const currencySym = currency === "INR" ? "₹" : "$";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Last 30 days — recovery pipeline, call performance, and attribution.
        </p>
      </div>

      {/* Top-level KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Revenue recovered"
              value={data ? formatMoney(data.totalRecovered, currency) : `${currencySym}0`}
              hint="Attributed to outbound calls"
            />
            <StatCard
              icon={<ShoppingCart className="h-4 w-4" />}
              label="Carts converted"
              value={data?.cartsConverted ?? 0}
              hint="Orders placed after call"
            />
            <StatCard
              icon={<Target className="h-4 w-4" />}
              label="Conversion rate"
              value={data ? pct(data.conversionRate) : "0%"}
              hint="Recovered + converted / scheduled"
            />
            <StatCard
              icon={<Phone className="h-4 w-4" />}
              label="Calls (30d)"
              value={overview?.calls_total ?? 0}
              hint={`${overview?.calls_completed ?? 0} completed`}
            />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily call volume sparkline */}
        <Card className="gap-0 overflow-visible py-0 shadow-card">
          <div className="border-b px-6 py-4">
            <div className="font-medium">Call volume — last 30 days</div>
          </div>
          <CardContent className="px-6 py-5">
            {loading ? (
              <Skeleton className="h-16" />
            ) : (
              <>
                <MiniSparkline data={data?.dailyVolume || []} />
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-primary/20 inline-block" />
                    Total
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" />
                    Completed
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recovery pipeline breakdown */}
        <Card className="gap-0 overflow-visible py-0 shadow-card">
          <div className="border-b px-6 py-4">
            <div className="font-medium">Recovery pipeline</div>
            <p className="text-xs text-muted-foreground mt-0.5">Scheduled call outcomes</p>
          </div>
          <CardContent className="px-6 py-5 space-y-3">
            {loading ? (
              <Skeleton className="h-32" />
            ) : !data || Object.keys(data.pipelineByStatus).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pipeline data yet. Data appears here once the Shopify integration triggers calls.
              </p>
            ) : (
              (() => {
                const entries = Object.entries(data.pipelineByStatus as Record<string, number>).sort((a, b) => b[1] - a[1]);
                const max = Math.max(...entries.map(([, v]) => v), 1);
                return entries.map(([status, count]) => (
                  <HBar
                    key={status}
                    label={status}
                    value={count}
                    max={max}
                    color={PIPELINE_COLORS[status] || "bg-muted-foreground"}
                  />
                ));
              })()
            )}
          </CardContent>
        </Card>
      </div>

      {/* Playbook performance table */}
      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="font-medium">Playbook performance</div>
        </div>
        <CardContent className="px-6 py-5">
          {loading ? (
            <Skeleton className="h-24" />
          ) : !data || Object.keys(data.playbookStats).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No playbook data yet. Enable a playbook in{" "}
              <a href="/playbooks" className="text-primary underline-offset-2 hover:underline">
                Playbooks settings
              </a>{" "}
              to start tracking.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium text-muted-foreground text-xs uppercase tracking-widest">Playbook</th>
                    <th className="pb-2 font-medium text-muted-foreground text-xs uppercase tracking-widest text-right">Scheduled</th>
                    <th className="pb-2 font-medium text-muted-foreground text-xs uppercase tracking-widest text-right">Recovered</th>
                    <th className="pb-2 font-medium text-muted-foreground text-xs uppercase tracking-widest text-right">Rate</th>
                    <th className="pb-2 font-medium text-muted-foreground text-xs uppercase tracking-widest text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(data.playbookStats).map(([key, stats]: [string, any]) => (
                    <tr key={key}>
                      <td className="py-3 font-medium">{PLAYBOOK_LABELS[key] || key}</td>
                      <td className="py-3 text-right font-mono">{stats.scheduled}</td>
                      <td className="py-3 text-right font-mono text-success">{stats.recovered}</td>
                      <td className="py-3 text-right font-mono">
                        {stats.scheduled > 0 ? pct((stats.recovered / stats.scheduled) * 100) : "—"}
                      </td>
                      <td className="py-3 text-right font-mono font-medium">
                        {stats.revenue > 0 ? formatMoney(stats.revenue, currency) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call status breakdown */}
      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="font-medium">Call status breakdown</div>
          <p className="text-xs text-muted-foreground mt-0.5">All voice calls in the last 30 days</p>
        </div>
        <CardContent className="px-6 py-5">
          {loading ? (
            <Skeleton className="h-32" />
          ) : !data?.dailyVolume?.length ? (
            <p className="text-sm text-muted-foreground">No calls recorded yet.</p>
          ) : (
            (() => {
              const total = (overview?.calls_total || 0);
              const statuses = [
                { label: "Completed", value: overview?.calls_completed || 0, color: "bg-primary" },
                { label: "Failed", value: total - (overview?.calls_completed || 0), color: "bg-destructive/60" },
              ].filter((s) => s.value > 0);
              const max = Math.max(...statuses.map((s) => s.value), 1);
              return (
                <div className="space-y-3">
                  {statuses.map((s) => (
                    <HBar key={s.label} label={s.label} value={s.value} max={max} color={s.color} />
                  ))}
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>
    </div>
  );
}

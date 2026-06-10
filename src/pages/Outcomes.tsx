import { useEffect, useState } from "react";
import { getOverview } from "../lib/db";
import { supabase } from "../lib/supabase";
import { getOrgId } from "../lib/db";
import { StatCard } from "../components/legacy-ui/StatCard";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { Skeleton } from "../components/legacy-ui/States";

export default function Outcomes() {
  const [overview, setOverview] = useState<any>(null);
  const [outcomes, setOutcomes] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      const o = await getOverview();
      setOverview(o || {});

      const orgId = await getOrgId();
      if (!orgId) {
        setOutcomes([]);
        return;
      }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data: calls } = await supabase
        .from("calls")
        .select("status")
        .eq("org_id", orgId)
        .gte("created_at", thirtyDaysAgo);

      const grouped: Record<string, number> = {};
      for (const c of calls || []) {
        grouped[c.status] = (grouped[c.status] || 0) + 1;
      }
      setOutcomes(
        Object.entries(grouped).map(([outcome, count]) => ({ outcome, count }))
      );
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outcomes</h1>
        <p className="text-sm text-text-muted mt-1">
          Last 30 days. Bookings, recoveries, opt-outs.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Calls" value={overview?.calls_total ?? 0} />
        <StatCard label="Completed" value={overview?.calls_completed ?? 0} />
        <StatCard label="Bookings" value={overview?.bookings ?? 0} />
        <StatCard
          label="Opt-outs"
          value={overview?.opt_outs ?? 0}
          hint="Lower is better"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="font-medium">Call status breakdown</div>
        </CardHeader>
        <CardBody>
          {outcomes === null ? (
            <Skeleton className="h-32" />
          ) : outcomes.length === 0 ? (
            <div className="text-sm text-text-muted">
              No calls recorded yet. Data will appear here once calls start flowing.
            </div>
          ) : (
            <Bars items={outcomes} valueKey="count" labelKey="outcome" />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Bars({
  items,
  valueKey,
  labelKey,
}: {
  items: any[];
  valueKey: string;
  labelKey: string;
}) {
  const max = Math.max(...items.map((i) => Number(i[valueKey]) || 0), 1);
  return (
    <div className="space-y-3">
      {items.map((it, i) => {
        const v = Number(it[valueKey]) || 0;
        const pct = (v / max) * 100;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-sm">
              <span className="capitalize">{it[labelKey] || "—"}</span>
              <span className="font-mono text-text-muted">{v}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

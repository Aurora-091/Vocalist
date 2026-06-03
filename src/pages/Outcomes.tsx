import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { StatCard } from "../components/ui/StatCard";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Skeleton } from "../components/ui/States";

export default function Outcomes() {
  const [overview, setOverview] = useState<any>(null);
  const [outcomes, setOutcomes] = useState<any[] | null>(null);
  const [optouts, setOptouts] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      const today = new Date();
      const from = new Date(today.getTime() - 30 * 86400_000)
        .toISOString()
        .slice(0, 10);
      const to = today.toISOString().slice(0, 10);
      const [o, b, op] = await Promise.all([
        api<any>(`/v1/analytics/overview?from=${from}&to=${to}`).catch(() => null),
        api<any>(`/v1/analytics/outcomes?from=${from}&to=${to}`).catch(() => null),
        api<any>(`/v1/analytics/optouts?from=${from}&to=${to}`).catch(() => null),
      ]);
      setOverview(o || {});
      setOutcomes(b?.outcomes || []);
      setOptouts(op?.opt_outs || []);
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="font-medium">Outcome breakdown</div>
          </CardHeader>
          <CardBody>
            {outcomes === null ? (
              <Skeleton className="h-32" />
            ) : outcomes.length === 0 ? (
              <div className="text-sm text-text-muted">
                No outcomes recorded yet.
              </div>
            ) : (
              <Bars items={outcomes} valueKey="count" labelKey="outcome" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="font-medium">Opt-out reasons</div>
          </CardHeader>
          <CardBody>
            {optouts === null ? (
              <Skeleton className="h-32" />
            ) : optouts.length === 0 ? (
              <div className="text-sm text-text-muted">
                No opt-outs in this window.
              </div>
            ) : (
              <Bars items={optouts} valueKey="count" labelKey="reason" />
            )}
          </CardBody>
        </Card>
      </div>
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
              <span>{it[labelKey] || "—"}</span>
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

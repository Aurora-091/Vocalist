import { useEffect, useState } from "react";
import { listPlanTiers, getUsageSummary, getSubscription } from "../lib/db";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { Button } from "../components/legacy-ui/Button";
import { Badge } from "../components/legacy-ui/Badge";
import { Skeleton } from "../components/legacy-ui/States";

type Tier = {
  id: string;
  key: string;
  label: string;
  monthly_usd: number;
  included_minutes: number;
  included_numbers: number;
  overage_rate_usd: number;
  features: any;
};

export default function Billing() {
  const [usage, setUsage] = useState<any>(null);
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [u, t, s] = await Promise.all([
        getUsageSummary(),
        listPlanTiers(),
        getSubscription(),
      ]);
      setUsage(u);
      setTiers(t);
      setSubscription(s);
    })();
  }, []);

  const pct = usage ? Math.min(100, Number(usage.pct_used) || 0) : 0;
  const used = Math.round(Number(usage?.used_minutes) || 0);
  const included = Number(usage?.included_minutes) || 0;
  const tone = pct >= 100 ? "danger" : pct >= 80 ? "warning" : "primary";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-text-muted mt-1">
          Plan, usage, and overage settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="font-medium">Usage this period</div>
            {usage && (
              <Badge tone={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "neutral"}>
                {Math.round(pct)}% used
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {!usage ? (
            <Skeleton className="h-24" />
          ) : (
            <>
              <div className="font-mono text-4xl font-bold">
                {used}{" "}
                <span className="text-text-muted text-base">
                  / {included || "—"} min
                </span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={`h-full ${
                    tone === "danger"
                      ? "bg-danger"
                      : tone === "warning"
                      ? "bg-warning"
                      : "bg-primary"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-3 text-xs text-text-muted">
                Overage at ${Number(usage.overage_cost_usd || 0).toFixed(2)} per minute.
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <section>
        <h2 className="text-sm font-medium text-text-muted uppercase tracking-widest mb-3">
          Plans
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {tiers === null
            ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)
            : tiers.map((t) => {
                const isCurrent =
                  subscription && subscription.plan_tier_id === t.id;
                return (
                  <div
                    key={t.id}
                    className={`bg-surface border rounded-md p-6 shadow-card ${
                      isCurrent ? "border-primary" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{t.label}</div>
                      {isCurrent && <Badge tone="primary">current</Badge>}
                    </div>
                    <div className="mt-4 font-mono text-3xl font-bold">
                      ${Number(t.monthly_usd)}
                      <span className="text-text-muted text-sm font-sans"> / mo</span>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm">
                      <li>
                        <span className="font-mono">{t.included_minutes}</span> minutes included
                      </li>
                      <li>
                        <span className="font-mono">{t.included_numbers}</span> phone numbers
                      </li>
                      <li>
                        ${Number(t.overage_rate_usd).toFixed(2)} per overage minute
                      </li>
                    </ul>
                    <div className="mt-6">
                      <Button
                        variant={isCurrent ? "secondary" : "primary"}
                        size="sm"
                        className="w-full"
                        disabled={isCurrent}
                      >
                        {isCurrent ? "Current plan" : "Switch"}
                      </Button>
                    </div>
                  </div>
                );
              })}
        </div>
      </section>
    </div>
  );
}

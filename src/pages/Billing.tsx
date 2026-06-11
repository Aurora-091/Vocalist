import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listPlanTiers, getUsageSummary, getSubscription } from "../lib/db";
import { api } from "../lib/api";
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
  const [switching, setSwitching] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

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

  const isCanceling = subscription?.status === "cancel_at_period_end";

  async function handleSwitchPlan(tierKey: string) {
    if (!subscription?.stripe_subscription_id) {
      // No subscription yet — go to checkout
      setSwitching(tierKey);
      try {
        const { url } = await api.post<{ url: string }>("/v1/billing/checkout", {
          plan_key: tierKey,
          success_url: window.location.href,
          cancel_url: window.location.href,
        });
        window.location.href = url;
      } catch (e: any) {
        toast.error(e.message || "Failed to start checkout");
        setSwitching(null);
      }
      return;
    }

    setSwitching(tierKey);
    try {
      await api.post("/v1/billing/change-plan", { plan_key: tierKey });
      toast.success("Plan updated successfully");
      const s = await getSubscription();
      setSubscription(s);
    } catch (e: any) {
      toast.error(e.message || "Failed to change plan");
    } finally {
      setSwitching(null);
    }
  }

  async function handleCancel() {
    setCanceling(true);
    try {
      await api.post("/v1/billing/cancel");
      toast.success("Subscription will cancel at period end");
      const s = await getSubscription();
      setSubscription(s);
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel subscription");
    } finally {
      setCanceling(false);
    }
  }

  async function handleReactivate() {
    setCanceling(true);
    try {
      await api.post("/v1/billing/reactivate");
      toast.success("Subscription reactivated");
      const s = await getSubscription();
      setSubscription(s);
    } catch (e: any) {
      toast.error(e.message || "Failed to reactivate subscription");
    } finally {
      setCanceling(false);
    }
  }

  async function openPortal() {
    try {
      const { url } = await api.post<{ url: string }>("/v1/billing/portal", {
        return_url: window.location.href,
      });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Failed to open billing portal");
    }
  }

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
                  className={`h-full transition-all duration-500 ${
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

      {subscription && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="font-medium">Subscription</div>
              <Badge tone={
                subscription.status === "active" ? "success" :
                subscription.status === "cancel_at_period_end" ? "warning" :
                subscription.status === "past_due" ? "danger" : "neutral"
              }>
                {subscription.status === "cancel_at_period_end" ? "Cancels at period end" : subscription.status}
              </Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="text-sm text-text-muted">
                {subscription.period_end
                  ? `${isCanceling ? "Ends" : "Renews"} ${new Date(subscription.period_end).toLocaleDateString()}`
                  : "No active period"}
              </div>
              <div className="flex gap-2">
                {subscription.stripe_customer_id && (
                  <Button variant="secondary" size="sm" onClick={openPortal}>
                    Manage invoices
                  </Button>
                )}
                {isCanceling ? (
                  <Button variant="primary" size="sm" onClick={handleReactivate} disabled={canceling}>
                    {canceling ? "Reactivating…" : "Reactivate"}
                  </Button>
                ) : subscription.status === "active" ? (
                  <Button variant="ghost" size="sm" onClick={handleCancel} disabled={canceling}>
                    {canceling ? "Canceling…" : "Cancel plan"}
                  </Button>
                ) : null}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <section>
        <h2 className="text-sm font-medium text-text-muted uppercase tracking-widest mb-3">
          Plans
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {tiers === null
            ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)
            : tiers.map((t) => {
                const isCurrent =
                  subscription &&
                  (subscription.plan_tier_key === t.key || subscription.plan_tier_id === t.id);
                const isLoading = switching === t.key;
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
                        disabled={isCurrent || isLoading || switching !== null}
                        onClick={() => !isCurrent && handleSwitchPlan(t.key)}
                      >
                        {isLoading ? "Switching…" : isCurrent ? "Current plan" : "Switch"}
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

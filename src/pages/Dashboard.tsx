import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Check } from "lucide-react";
import { api } from "../lib/api";
import { StatCard } from "../components/ui/StatCard";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/States";

const STEP_LABELS: Record<string, string> = {
  pick_vertical: "Pick your business",
  connect_tools: "Connect a tool",
  add_knowledge: "Add knowledge",
  create_agent: "Create your agent",
  get_number: "Get a phone number",
  test_and_golive: "Test and go live",
};

const STEP_LINKS: Record<string, string> = {
  pick_vertical: "/onboarding",
  connect_tools: "/integrations",
  add_knowledge: "/integrations",
  create_agent: "/agents",
  get_number: "/integrations",
  test_and_golive: "/agents",
};

export default function Dashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [steps, setSteps] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [o, u, ob] = await Promise.all([
          api<any>("/v1/analytics/overview"),
          api<any>(`/v1/analytics/usage?period=${today}`),
          api<any>("/v1/onboarding"),
        ]);
        setOverview(o);
        setUsage(u);
        setSteps(ob.steps || {});
      } catch {
        setOverview({ calls_total: 0, calls_completed: 0, opt_outs: 0, minutes_used: 0 });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const checklistDone = steps && Object.values(steps).every(Boolean);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          <p className="text-sm text-text-muted mt-1">
            Live operations across your agents and campaigns.
          </p>
        </div>
        <Link to="/campaigns/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New campaign
          </Button>
        </Link>
      </div>

      {steps && !checklistDone && (
        <Card>
          <CardHeader>
            <div className="font-medium">Finish setting up Aurora</div>
            <p className="text-xs text-text-muted mt-1">
              {Object.values(steps).filter(Boolean).length} of{" "}
              {Object.keys(steps).length} done
            </p>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {Object.entries(steps).map(([key, done]) => (
                <li key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        done ? "bg-success/15 text-success" : "bg-surface-2 text-text-muted"
                      }`}
                    >
                      {done ? <Check className="w-3 h-3" /> : null}
                    </span>
                    <span className={done ? "text-text-muted line-through" : ""}>
                      {STEP_LABELS[key] || key}
                    </span>
                  </div>
                  {!done && (
                    <Link to={STEP_LINKS[key] || "/"}>
                      <Button variant="ghost" size="sm">
                        Start
                      </Button>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard label="Calls (30d)" value={overview?.calls_total ?? 0} />
            <StatCard label="Completed" value={overview?.calls_completed ?? 0} />
            <StatCard label="Bookings" value={overview?.bookings ?? 0} />
            <StatCard
              label="Opt-outs"
              value={overview?.opt_outs ?? 0}
              hint="Lower is better"
            />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="font-medium">Live now</div>
          </CardHeader>
          <CardBody>
            <div className="text-sm text-text-muted">
              No live calls right now. Place a test call from any agent to see
              one here.
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <div className="font-medium">Usage this period</div>
          </CardHeader>
          <CardBody>
            {usage ? (
              <>
                <div className="font-mono text-3xl font-bold">
                  {Math.round(Number(usage.used_minutes) || 0)}{" "}
                  <span className="text-text-muted text-base">/ {usage.included_minutes || "—"} min</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, Number(usage.pct_used) || 0)}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-text-muted">
                  Renews monthly. Overage at $
                  {Number(usage.overage_cost_usd || 0).toFixed(2)}.
                </div>
              </>
            ) : (
              <Skeleton className="h-24" />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

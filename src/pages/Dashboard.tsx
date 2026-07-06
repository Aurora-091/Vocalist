import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Check, Sparkles, Phone, Bot, Megaphone } from "lucide-react";
import { getOverview, getUsageSummary, getOnboardingSteps, listRecentCalls } from "../lib/db";
import { supabase } from "../lib/supabase";
import { useVertical } from "../lib/VerticalContext";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
  add_knowledge: "/knowledge",
  create_agent: "/agents",
  get_number: "/numbers",
  test_and_golive: "/agents",
};

export default function Dashboard() {
  const { config } = useVertical();
  const [overview, setOverview] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [steps, setSteps] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveCalls, setLiveCalls] = useState<any[]>([]);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [o, u, s] = await Promise.all([
          getOverview(),
          getUsageSummary(),
          getOnboardingSteps(),
        ]);
        setOverview(o);
        setUsage(u);
        setSteps(s);
      } catch {
        setOverview({ calls_total: 0, calls_completed: 0, opt_outs: 0, bookings: 0 });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("live-calls")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls", filter: "status=eq.in_progress" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const call = payload.new;
            if (call.status === "in_progress") {
              setLiveCalls((prev) => {
                const exists = prev.find((c) => c.id === call.id);
                if (exists) return prev.map((c) => (c.id === call.id ? call : c));
                return [call, ...prev].slice(0, 10);
              });
            } else {
              setLiveCalls((prev) => prev.filter((c) => c.id !== call.id));
            }
          }
          if (payload.eventType === "DELETE") {
            setLiveCalls((prev) => prev.filter((c) => c.id !== payload.old?.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await listRecentCalls(3);
        setRecentCalls(data);
      } catch {}
    })();
  }, []);

  const checklistDone = steps && Object.values(steps).every(Boolean);
  const isEmpty = !loading && (overview?.calls_total ?? 0) === 0;

  function getMetricValue(key: string): number | string {
    if (!overview) return 0;
    const raw = overview[key];
    if (raw !== undefined) return raw;
    if (key === "carts_recovered" || key === "reservations") return overview.carts_recovered ?? overview.bookings ?? 0;
    if (key === "revenue_recovered") {
      const val = overview.revenue_recovered ?? 0;
      const curr = overview.revenue_currency === "INR" ? "\u20B9" : "$";
      return val ? `${curr}${Number(val).toLocaleString()}` : `${curr}0`;
    }
    if (key === "no_shows_prevented") return overview.no_shows_prevented ?? 0;
    if (key === "checkins_handled") return overview.checkins_handled ?? 0;
    return 0;
  }

  const { emptyStates, dashboard } = config;

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

      {isEmpty && !steps && (
        <Card className="gap-0 overflow-visible py-0 shadow-card border-border bg-surface-2">
          <CardContent className="px-6 py-5">
            <div className="flex items-start gap-4">
              <span className="w-9 h-9 rounded-md bg-surface border border-border text-text-muted flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </span>
              <div className="flex-1">
                <div className="font-medium">{emptyStates.dashboard.title}</div>
                <p className="text-sm text-text-muted mt-1">
                  {emptyStates.dashboard.description}
                </p>
                <div className="mt-4">
                  <Link to={emptyStates.dashboard.route}>
                    <Button size="sm">{emptyStates.dashboard.cta}</Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {steps && !checklistDone && (
        <Card className="gap-0 overflow-visible py-0 shadow-card">
          <div className="border-b px-6 py-4">
            <div className="font-medium">Finish setting up Weeber</div>
            <p className="text-xs text-text-muted mt-1">
              {Object.values(steps).filter(Boolean).length} of{" "}
              {Object.keys(steps).length} done
            </p>
          </div>
          <CardContent className="px-6 py-5">
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
          </CardContent>
        </Card>
      )}

      {/* Metrics driven by vertical config */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          dashboard.metrics.map((m) => (
            <StatCard
              key={m.key}
              label={m.label}
              value={getMetricValue(m.key)}
              hint={m.hint}
            />
          ))
        )}
      </div>

      {/* Dashboard cards driven by vertical config */}
      <div className="grid sm:grid-cols-2 gap-4">
        {dashboard.cards.map((card) => {
          const CardIcon = card.icon;
          const bgColor = card.color === "blue"
            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
            : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400";
          return (
            <Card key={card.id} className="gap-0 overflow-visible py-0 shadow-card hover:border-primary/30 transition-colors">
              <CardContent className="px-6 py-5">
                <div className="flex items-start gap-4">
                  <span className={`w-10 h-10 rounded-md ${bgColor} flex items-center justify-center shrink-0`}>
                    <CardIcon className="w-5 h-5" />
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">{card.title}</div>
                    <p className="text-sm text-text-muted mt-1">{card.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {card.links.map((link, i) => (
                        <Link key={link.to} to={link.to}>
                          <Button size="sm" variant={i === 0 ? "outline" : "ghost"}>
                            {i === 0 && card.id === "inbound" && <Bot className="w-3.5 h-3.5 mr-1.5" />}
                            {i === 0 && card.id === "outbound" && <Megaphone className="w-3.5 h-3.5 mr-1.5" />}
                            {link.label}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick actions from vertical config */}
      {config.quickActions.length > 0 && !isEmpty && (
        <Card className="gap-0 overflow-visible py-0 shadow-card">
          <div className="border-b px-6 py-4">
            <div className="font-medium">Quick actions</div>
          </div>
          <CardContent className="px-6 py-5">
            <div className="grid sm:grid-cols-3 gap-3">
              {config.quickActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <Link
                    key={action.key}
                    to={action.route}
                    className="group border border-border rounded-md p-4 hover:border-primary/30 hover:bg-surface-2/50 transition-colors"
                  >
                    <ActionIcon className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors mb-2" />
                    <div className="font-medium text-sm">{action.label}</div>
                    <p className="text-xs text-text-muted mt-1">{action.description}</p>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live calls + Usage */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="gap-0 overflow-visible py-0 shadow-card">
          <div className="border-b px-6 py-4">
            <div className="flex items-center gap-2" role="status" aria-live="polite" aria-atomic="true">
              <span className="relative flex h-2 w-2">
                {liveCalls.length > 0 && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${liveCalls.length > 0 ? "bg-success" : "bg-border"}`} />
              </span>
              <span className="font-medium">Live now</span>
              {liveCalls.length > 0 && (
                <span className="text-xs text-text-muted ml-1">({liveCalls.length})</span>
              )}
            </div>
          </div>
          <CardContent className="px-6 py-5">
            {liveCalls.length === 0 ? (
              recentCalls.length > 0 ? (
                <div>
                  <p className="text-xs text-text-muted mb-3">No live calls right now. Recent activity:</p>
                  <ul className="space-y-2">
                    {recentCalls.map((call) => (
                      <li key={call.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2.5">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-mono text-xs">{call.to_number || "Unknown"}</span>
                        </div>
                        <span className="text-xs text-text-muted capitalize">
                          {call.status?.replace("_", " ") || call.direction}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-sm text-text-muted">
                  {emptyStates.calls.description}
                </div>
              )
            ) : (
              <ul className="space-y-2.5">
                {liveCalls.map((call) => (
                  <li key={call.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-3.5 h-3.5 text-success" />
                      <span className="font-mono text-xs">{call.to_number || "Unknown"}</span>
                    </div>
                    <span className="text-xs text-text-muted">
                      {call.direction === "inbound" ? "Inbound" : "Outbound"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="gap-0 overflow-visible py-0 shadow-card">
          <div className="border-b px-6 py-4">
            <div className="font-medium">Usage this period</div>
          </div>
          <CardContent className="px-6 py-5">
            {usage ? (
              <>
                <div className="font-mono text-3xl font-bold">
                  {Math.round(Number(usage.used_minutes) || 0)}{" "}
                  <span className="text-text-muted text-base">/ {usage.included_minutes || "\u2014"} min</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, Number(usage.pct_used) || 0)}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-text-muted">
                  Renews monthly. Overage at $
                  {Number(usage.overage_cost_usd || 0).toFixed(2)}/min.
                </div>
              </>
            ) : (
              <Skeleton className="h-24" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

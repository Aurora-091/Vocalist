import { useEffect, useState, useCallback } from "react";
import { ChartBar as BarChart2, TrendingDown, Phone, CircleCheck as CheckCircle, UserMinus, DollarSign } from "lucide-react";
import { api } from "../lib/api";
import { StatCard } from "../components/legacy-ui/StatCard";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { Skeleton } from "../components/legacy-ui/States";

type Range = "7d" | "30d" | "90d";

const RANGES: { label: string; value: Range; days: number }[] = [
  { label: "7 days", value: "7d", days: 7 },
  { label: "30 days", value: "30d", days: 30 },
  { label: "90 days", value: "90d", days: 90 },
];

function rangeParams(days: number) {
  const to = new Date();
  const from = new Date(Date.now() - days * 86400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

type Overview = {
  calls_total: number;
  calls_completed: number;
  avg_duration_sec: number;
  total_cost_usd: number;
  opt_outs: number;
  bookings: number;
};

type OutcomeRow = {
  outcome: string;
  count: number;
};

type SeriesRow = {
  day: string;
  count: number;
};

type OptoutRow = {
  day: string;
  count: number;
};

const OUTCOME_COLORS: Record<string, string> = {
  completed: "#22c55e",
  no_answer: "#94a3b8",
  voicemail: "#60a5fa",
  failed: "#ef4444",
  opt_out: "#f97316",
  busy: "#a78bfa",
};

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full bg-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function SparkLine({
  series,
  color = "#60a5fa",
  label,
}: {
  series: SeriesRow[] | OptoutRow[];
  color?: string;
  label?: string;
}) {
  if (!series || series.length === 0) {
    return (
      <div className="flex items-center justify-center h-28 text-xs text-text-muted">
        No data for this period
      </div>
    );
  }

  const values = series.map((r) => r.count);
  const max = Math.max(...values, 1);
  const width = 480;
  const height = 96;
  const padX = 4;
  const padY = 8;

  const pts = series.map((r, i) => {
    const x = padX + (i / Math.max(series.length - 1, 1)) * (width - padX * 2);
    const y = padY + (1 - r.count / max) * (height - padY * 2);
    return { x, y, v: r.count, d: r.day };
  });

  const pathD = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const areaD =
    `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${height - padY} L ${pts[0].x.toFixed(1)} ${height - padY} Z`;

  return (
    <div>
      {label && <div className="text-xs text-text-muted mb-2">{label}</div>}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${label})`} />
        <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-text-muted mt-1">
        <span>{series[0]?.day?.slice(5)}</span>
        <span>{series[series.length - 1]?.day?.slice(5)}</span>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [range, setRange] = useState<Range>("30d");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [outcomes, setOutcomes] = useState<OutcomeRow[] | null>(null);
  const [series, setSeries] = useState<SeriesRow[] | null>(null);
  const [optouts, setOptouts] = useState<OptoutRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const days = RANGES.find((r) => r.value === range)!.days;
    const { from, to } = rangeParams(days);
    const qs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

    try {
      const [ov, oc, sr, op] = await Promise.allSettled([
        api.get<any>(`/v1/analytics/overview?${qs}`),
        api.get<any>(`/v1/analytics/outcomes?${qs}`),
        api.get<any>(`/v1/analytics/optouts?${qs}`),
        api.get<any>(`/v1/analytics/usage`),
      ]);

      if (ov.status === "fulfilled") {
        const d = ov.value;
        setOverview({
          calls_total: d.calls_total ?? 0,
          calls_completed: d.calls_completed ?? 0,
          avg_duration_sec: d.avg_duration_sec ?? 0,
          total_cost_usd: d.total_cost_usd ?? 0,
          opt_outs: d.opt_outs ?? 0,
          bookings: d.bookings ?? 0,
        });
      }

      if (oc.status === "fulfilled") {
        const raw = oc.value.outcomes || [];
        const normalized: OutcomeRow[] = Array.isArray(raw)
          ? raw.map((r: any) => ({ outcome: r.outcome || r.status || "unknown", count: Number(r.count) || 0 }))
          : Object.entries(raw).map(([k, v]) => ({ outcome: k, count: Number(v) }));
        setOutcomes(normalized);
      }

      if (op.status === "fulfilled") {
        const raw = op.value.series || [];
        setOptouts(
          Array.isArray(raw)
            ? raw.map((r: any) => ({ day: r.day || r.period || "", count: Number(r.count) || 0 }))
            : []
        );
      }

      if (sr.status === "fulfilled") {
        const d = sr.value;
        if (Array.isArray(d)) {
          setSeries(d.map((r: any) => ({ day: r.period || r.day || "", count: Number(r.calls) || Number(r.count) || 0 })));
        } else {
          setSeries([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const completionRate =
    overview && overview.calls_total > 0
      ? Math.round((overview.calls_completed / overview.calls_total) * 100)
      : 0;

  const avgDurationMin = overview
    ? `${Math.floor(overview.avg_duration_sec / 60)}m ${Math.round(overview.avg_duration_sec % 60)}s`
    : "—";

  const maxOutcome = outcomes ? Math.max(...outcomes.map((o) => o.count), 1) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-text-muted mt-1">
            Call performance, outcomes, and opt-out trends.
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-surface-2 rounded-md border border-border">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                range === r.value
                  ? "bg-surface text-text font-medium shadow-sm border border-border"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total calls"
              value={overview?.calls_total ?? 0}
              icon={<Phone className="w-4 h-4" />}
            />
            <StatCard
              label="Completion rate"
              value={`${completionRate}%`}
              icon={<CheckCircle className="w-4 h-4" />}
            />
            <StatCard
              label="Avg duration"
              value={avgDurationMin}
              icon={<BarChart2 className="w-4 h-4" />}
            />
            <StatCard
              label="Opt-outs"
              value={overview?.opt_outs ?? 0}
              icon={<UserMinus className="w-4 h-4" />}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <div className="font-medium">Call outcomes</div>
              </CardHeader>
              <CardBody>
                {!outcomes || outcomes.length === 0 ? (
                  <div className="text-sm text-text-muted py-8 text-center">No outcome data yet</div>
                ) : (
                  <div className="space-y-3">
                    {outcomes
                      .sort((a, b) => b.count - a.count)
                      .map((o) => (
                        <div key={o.outcome}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize text-text-muted">
                              {o.outcome.replace(/_/g, " ")}
                            </span>
                            <span className="font-mono text-text">{o.count}</span>
                          </div>
                          <MiniBar
                            value={o.count}
                            max={maxOutcome}
                            color={OUTCOME_COLORS[o.outcome] ?? "#94a3b8"}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="font-medium">Calls over time</div>
              </CardHeader>
              <CardBody>
                {series !== null ? (
                  <SparkLine series={series} color="#60a5fa" label="Calls per day" />
                ) : (
                  <Skeleton className="h-28" />
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-danger" />
                <div className="font-medium">Opt-out trend</div>
              </div>
            </CardHeader>
            <CardBody>
              {optouts !== null ? (
                <SparkLine series={optouts} color="#f97316" label="Opt-outs per day" />
              ) : (
                <Skeleton className="h-28" />
              )}
              {optouts && optouts.length > 0 && (
                <p className="text-xs text-text-muted mt-3">
                  High opt-out rates may indicate consent or timing issues. Review
                  your agent's opening script if you see a spike.
                </p>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

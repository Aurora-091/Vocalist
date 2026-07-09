import { useEffect, useState } from "react";
import { Users, ClipboardList, Activity, Phone, DollarSign, CreditCard } from "lucide-react";
import { adminApi, type AdminStats, type AdminUser, type LogEntry } from "../../lib/admin-api";
import { api } from "../../lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function StatCard({
  label,
  value,
  icon: Icon,
  current,
  prev,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  current?: number;
  prev?: number;
}) {
  let trendElement = null;
  if (current !== undefined && prev !== undefined && prev !== null && prev > 0) {
    const diff = current - prev;
    if (diff !== 0) {
      const pct = (diff / prev) * 100;
      const isPositive = diff > 0;
      trendElement = (
        <div className={`text-xs font-semibold mt-2 flex items-center gap-0.5 ${isPositive ? "text-success" : "text-danger"}`}>
          <span>{isPositive ? "▲" : "▼"}</span>
          <span>{Math.abs(pct).toFixed(0)}%</span>
        </div>
      );
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-mono font-bold text-foreground">{value}</div>
      </div>
      {trendElement}
    </div>
  );
}

export default function AdminDashboard() {
  const [range, setRange] = useState("7d");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [signups, setSignups] = useState<AdminUser[]>([]);
  const [errors, setErrors] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [chartData, setChartData] = useState<{ labels: string[]; values: number[] } | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

  // Load signups and errors once on mount
  useEffect(() => {
    Promise.all([
      adminApi.getRecentSignups(),
      adminApi.getRecentErrors(),
    ]).then(([su, er]) => {
      setSignups(su);
      setErrors(er);
    });
  }, []);

  // Load stats and chart data whenever range changes
  useEffect(() => {
    setLoading(true);
    adminApi.getStats(range)
      .then(s => setStats(s))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    setChartLoading(true);
    api.get<{ labels: string[]; values: number[] }>(`/v1/admin/stats/calls-chart?range=${range}`)
      .then(res => setChartData(res))
      .catch(() => setChartData(null))
      .finally(() => setChartLoading(false));
  }, [range]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <div className="w-[180px] bg-card border border-border rounded-md h-10 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-5 animate-pulse h-28" />
          ))}
        </div>
      </div>
    );
  }

  // Bar chart metrics calculation
  const maxValue = chartData && chartData.values.length > 0 ? Math.max(...chartData.values, 5) : 5;
  const isChartEmpty = !chartData || chartData.values.every(v => v === 0);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="w-[180px]">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger>
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats?.total_users ?? 0} current={stats?.total_users} prev={stats?.prev_total_users} icon={Users} />
        <StatCard label="Waitlist (Pending)" value={stats?.waitlist_pending ?? 0} current={stats?.waitlist_pending} prev={stats?.prev_waitlist_pending} icon={ClipboardList} />
        <StatCard label="Active (7d)" value={stats?.active_users_7d ?? 0} current={stats?.active_users_7d} prev={stats?.prev_active_users_7d} icon={Activity} />
        <StatCard label="Calls Today" value={stats?.calls_today ?? 0} current={stats?.calls_today} prev={stats?.prev_calls_today} icon={Phone} />
        <StatCard label="Monthly Cost" value={`$${(stats?.monthly_cost ?? 0).toFixed(2)}`} current={stats?.monthly_cost} prev={stats?.prev_monthly_cost} icon={DollarSign} />
        <StatCard label="Active Subs" value={stats?.active_subscriptions ?? 0} current={stats?.active_subscriptions} prev={stats?.prev_active_subscriptions} icon={CreditCard} />
        <StatCard label="Total Calls (Period)" value={stats?.total_calls ?? 0} current={stats?.total_calls} prev={stats?.prev_total_calls} icon={Phone} />
      </div>

      {/* Call Volume Section */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">Call Volume</h2>
        {chartLoading ? (
          <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">
            Loading chart data...
          </div>
        ) : isChartEmpty ? (
          <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground bg-muted/10 rounded border border-dashed">
            No data yet
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[500px] h-[120px] relative">
              <svg viewBox="0 0 600 120" className="w-full h-full">
                {/* Horizontal grid lines */}
                <line x1={40} y1={10} x2={590} y2={10} className="stroke-border" strokeDasharray="3 3" />
                <line x1={40} y1={55} x2={590} y2={55} className="stroke-border" strokeDasharray="3 3" />
                <line x1={40} y1={100} x2={590} y2={100} className="stroke-border" strokeDasharray="3 3" />

                {/* Y-axis Labels */}
                <text x={35} y={14} textAnchor="end" className="text-[10px] fill-muted-foreground select-none font-mono">
                  {maxValue}
                </text>
                <text x={35} y={59} textAnchor="end" className="text-[10px] fill-muted-foreground select-none font-mono">
                  {Math.round(maxValue / 2)}
                </text>
                <text x={35} y={104} textAnchor="end" className="text-[10px] fill-muted-foreground select-none font-mono">
                  0
                </text>

                {/* Bars */}
                {chartData && chartData.values.map((val, i) => {
                  const barHeight = (val / maxValue) * 90;
                  const barWidth = Math.max(4, (550 / chartData.values.length) - 6);
                  const x = 40 + i * (550 / chartData.values.length) + 3;
                  const y = 100 - barHeight;

                  // Render X-axis labels selectively to prevent overlap
                  const showLabel = chartData.values.length <= 10 || i % Math.ceil(chartData.values.length / 10) === 0 || i === chartData.values.length - 1;

                  return (
                    <g key={i}>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx={1.5}
                        className="fill-foreground/80 dark:fill-foreground/90 hover:fill-foreground transition-colors"
                      >
                        <title>{`${chartData.labels[i]}: ${val} calls`}</title>
                      </rect>
                      {showLabel && (
                        <text
                          x={x + barWidth / 2}
                          y={115}
                          textAnchor="middle"
                          className="text-[9px] fill-muted-foreground select-none font-medium"
                        >
                          {chartData.labels[i]}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Recent Signups</h2>
          </div>
          <div className="divide-y divide-border">
            {signups.length === 0 && (
              <div className="px-5 py-8 text-sm text-muted-foreground text-center">No signups yet</div>
            )}
            {signups.slice(0, 8).map((u) => (
              <div key={u.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{u.display_name || u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Recent Errors</h2>
          </div>
          <div className="divide-y divide-border">
            {errors.length === 0 && (
              <div className="px-5 py-8 text-sm text-muted-foreground text-center">No errors</div>
            )}
            {errors.slice(0, 8).map((e) => (
              <div key={e.id} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-1.5 py-0.5 bg-destructive/10 text-destructive rounded">{e.source}</span>
                  <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-foreground mt-1 truncate">{e.error_message || e.event_type}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


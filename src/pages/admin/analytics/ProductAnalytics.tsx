import { useEffect, useState } from "react";
import { Users, Zap, Eye, MonitorDot, RefreshCw } from "lucide-react";
import { adminApi, type PostHogInsights, type PostHogTopPage, type PostHogTopEvent, type PostHogUserActivity } from "@/lib/admin-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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
  if (current !== undefined && prev !== undefined && prev > 0) {
    const diff = current - prev;
    if (diff !== 0) {
      const pct = (diff / prev) * 100;
      const isPositive = diff > 0;
      trendElement = (
        <div className={`text-xs font-semibold mt-2 flex items-center gap-0.5 ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
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

function ActivityChart({ data, loading }: { data: PostHogUserActivity[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="h-[140px] flex items-center justify-center text-sm text-muted-foreground">
        Loading chart data...
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="h-[140px] flex items-center justify-center text-sm text-muted-foreground bg-muted/10 rounded border border-dashed">
        No data yet — events will appear once users visit your site
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.users), 5);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[500px] h-[140px] relative">
        <svg viewBox="0 0 600 140" className="w-full h-full">
          {/* Grid lines */}
          <line x1={40} y1={10} x2={590} y2={10} className="stroke-border" strokeDasharray="3 3" />
          <line x1={40} y1={60} x2={590} y2={60} className="stroke-border" strokeDasharray="3 3" />
          <line x1={40} y1={110} x2={590} y2={110} className="stroke-border" strokeDasharray="3 3" />

          {/* Y-axis */}
          <text x={35} y={14} textAnchor="end" className="text-[10px] fill-muted-foreground select-none font-mono">{maxValue}</text>
          <text x={35} y={64} textAnchor="end" className="text-[10px] fill-muted-foreground select-none font-mono">{Math.round(maxValue / 2)}</text>
          <text x={35} y={114} textAnchor="end" className="text-[10px] fill-muted-foreground select-none font-mono">0</text>

          {/* Bars */}
          {data.map((d, i) => {
            const barHeight = (d.users / maxValue) * 100;
            const barWidth = Math.max(4, (550 / data.length) - 6);
            const x = 40 + i * (550 / data.length) + 3;
            const y = 110 - barHeight;
            const showLabel = data.length <= 14 || i % Math.ceil(data.length / 10) === 0 || i === data.length - 1;

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
                  <title>{`${d.date}: ${d.users} users`}</title>
                </rect>
                {showLabel && (
                  <text
                    x={x + barWidth / 2}
                    y={128}
                    textAnchor="middle"
                    className="text-[8px] fill-muted-foreground select-none font-medium"
                  >
                    {String(d.date).slice(5)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function DataTable({
  title,
  columns,
  rows,
  loading,
  emptyText,
}: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  loading: boolean;
  emptyText: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {loading ? (
        <div className="px-5 py-8 text-sm text-muted-foreground text-center">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted-foreground text-center">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {columns.map((col) => (
                  <th key={col} className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-5 py-3 ${j === 0 ? "font-medium truncate max-w-[300px]" : "font-mono text-muted-foreground"}`}>
                      {typeof cell === "number" ? cell.toLocaleString() : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ProductAnalytics() {
  const [range, setRange] = useState("7d");
  const [insights, setInsights] = useState<PostHogInsights | null>(null);
  const [topPages, setTopPages] = useState<PostHogTopPage[]>([]);
  const [topEvents, setTopEvents] = useState<PostHogTopEvent[]>([]);
  const [activity, setActivity] = useState<PostHogUserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchAll(r: string) {
    setLoading(true);
    setActivityLoading(true);
    setTablesLoading(true);
    setError(null);

    adminApi.getPostHogInsights(r)
      .then(setInsights)
      .catch((e) => setError(e.message || "Failed to load PostHog data"))
      .finally(() => setLoading(false));

    adminApi.getPostHogUserActivity(r)
      .then(setActivity)
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));

    Promise.all([
      adminApi.getPostHogTopPages(r).catch(() => [] as PostHogTopPage[]),
      adminApi.getPostHogTopEvents(r).catch(() => [] as PostHogTopEvent[]),
    ]).then(([pages, events]) => {
      setTopPages(pages);
      setTopEvents(events);
    }).finally(() => setTablesLoading(false));
  }

  useEffect(() => {
    fetchAll(range);
  }, [range]);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Product Analytics</h1>
        <div className="flex items-center justify-center py-12">
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 text-center space-y-4 shadow-sm">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">PostHog Not Configured</h2>
              <p className="text-sm text-muted-foreground">
                {error.includes("not_configured")
                  ? "Add POSTHOG_API_KEY and POSTHOG_PROJECT_ID to your backend environment variables."
                  : error}
              </p>
            </div>
            <Button variant="outline" onClick={() => fetchAll(range)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !insights) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Product Analytics</h1>
          <div className="w-[180px] bg-card border border-border rounded-md h-10 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-5 animate-pulse h-28" />
          ))}
        </div>
        <div className="bg-card border border-border rounded-lg p-5 animate-pulse h-[180px]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Product Analytics</h1>
          <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">PostHog</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => fetchAll(range)} className="h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <div className="w-[180px]">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger>
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="90d">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Unique Users" value={insights?.unique_users ?? 0} current={insights?.unique_users} prev={insights?.prev_unique_users} icon={Users} />
        <StatCard label="Total Events" value={insights?.total_events ?? 0} current={insights?.total_events} prev={insights?.prev_total_events} icon={Zap} />
        <StatCard label="Pageviews" value={insights?.pageviews ?? 0} current={insights?.pageviews} prev={insights?.prev_pageviews} icon={Eye} />
        <StatCard label="Sessions" value={insights?.sessions ?? 0} current={insights?.sessions} prev={insights?.prev_sessions} icon={MonitorDot} />
      </div>

      {/* User Activity Chart */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">Daily Active Users</h2>
        <ActivityChart data={activity} loading={activityLoading} />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DataTable
          title="Top Pages"
          columns={["URL", "Views", "Users"]}
          rows={topPages.map((p) => {
            let url = p.url;
            try { url = new URL(p.url).pathname; } catch { /* keep full URL */ }
            return [url, p.views, p.unique_users];
          })}
          loading={tablesLoading}
          emptyText="No pageview data yet"
        />
        <DataTable
          title="Top Events"
          columns={["Event", "Count", "Users"]}
          rows={topEvents.map((e) => [e.event, e.count, e.unique_users])}
          loading={tablesLoading}
          emptyText="No custom events yet"
        />
      </div>
    </div>
  );
}

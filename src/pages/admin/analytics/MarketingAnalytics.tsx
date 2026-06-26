import { useEffect, useState } from "react";
import { Globe, Link2, RefreshCw } from "lucide-react";
import { adminApi, type PostHogReferrer, type PostHogCountry, type PostHogUserActivity } from "@/lib/admin-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

function PageviewChart({ data, loading }: { data: PostHogUserActivity[]; loading: boolean }) {
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
        No data yet — traffic data will appear once users visit your site
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.users), 5);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[500px] h-[140px] relative">
        <svg viewBox="0 0 600 140" className="w-full h-full">
          <line x1={40} y1={10} x2={590} y2={10} className="stroke-border" strokeDasharray="3 3" />
          <line x1={40} y1={60} x2={590} y2={60} className="stroke-border" strokeDasharray="3 3" />
          <line x1={40} y1={110} x2={590} y2={110} className="stroke-border" strokeDasharray="3 3" />

          <text x={35} y={14} textAnchor="end" className="text-[10px] fill-muted-foreground select-none font-mono">{maxValue}</text>
          <text x={35} y={64} textAnchor="end" className="text-[10px] fill-muted-foreground select-none font-mono">{Math.round(maxValue / 2)}</text>
          <text x={35} y={114} textAnchor="end" className="text-[10px] fill-muted-foreground select-none font-mono">0</text>

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
  icon: Icon,
  columns,
  rows,
  loading,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  columns: string[];
  rows: (string | number)[][];
  loading: boolean;
  emptyText: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
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

function formatReferrer(raw: string): string {
  if (!raw) return "(direct)";
  try {
    const url = new URL(raw);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
}

export default function MarketingAnalytics() {
  const [range, setRange] = useState("7d");
  const [referrers, setReferrers] = useState<PostHogReferrer[]>([]);
  const [countries, setCountries] = useState<PostHogCountry[]>([]);
  const [activity, setActivity] = useState<PostHogUserActivity[]>([]);
  const [referrersLoading, setReferrersLoading] = useState(true);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchAll(r: string) {
    setReferrersLoading(true);
    setCountriesLoading(true);
    setActivityLoading(true);
    setError(null);

    adminApi.getPostHogReferrers(r)
      .then(setReferrers)
      .catch((e) => {
        setReferrers([]);
        if (e.message?.includes("not_configured")) setError(e.message);
      })
      .finally(() => setReferrersLoading(false));

    adminApi.getPostHogCountries(r)
      .then(setCountries)
      .catch(() => setCountries([]))
      .finally(() => setCountriesLoading(false));

    adminApi.getPostHogUserActivity(r)
      .then(setActivity)
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }

  useEffect(() => {
    fetchAll(range);
  }, [range]);

  if (error?.includes("not_configured")) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Marketing Analytics</h1>
        <div className="flex items-center justify-center py-12">
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 text-center space-y-4 shadow-sm">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">PostHog Not Configured</h2>
              <p className="text-sm text-muted-foreground">
                Add POSTHOG_API_KEY and POSTHOG_PROJECT_ID to your backend environment variables.
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

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Marketing Analytics</h1>
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

      {/* Traffic Over Time */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">Traffic Over Time</h2>
        <PageviewChart data={activity} loading={activityLoading} />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DataTable
          title="Top Referrers"
          icon={Link2}
          columns={["Source", "Visits", "Users"]}
          rows={referrers.map((r) => [formatReferrer(r.referrer), r.visits, r.unique_users])}
          loading={referrersLoading}
          emptyText="No referrer data yet"
        />
        <DataTable
          title="Top Countries"
          icon={Globe}
          columns={["Country", "Users", "Events"]}
          rows={countries.map((c) => [c.country, c.users, c.events])}
          loading={countriesLoading}
          emptyText="No geolocation data yet"
        />
      </div>
    </div>
  );
}

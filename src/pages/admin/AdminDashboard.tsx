import { useEffect, useState } from "react";
import { Users, ClipboardList, Activity, Phone, DollarSign, CreditCard } from "lucide-react";
import { adminApi, type AdminStats, type AdminUser, type LogEntry } from "../../lib/admin-api";

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-mono font-bold text-foreground">{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [signups, setSignups] = useState<AdminUser[]>([]);
  const [errors, setErrors] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.getStats(),
      adminApi.getRecentSignups(),
      adminApi.getRecentErrors(),
    ]).then(([s, su, er]) => {
      setStats(s);
      setSignups(su);
      setErrors(er);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-5 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Users" value={stats?.total_users ?? 0} icon={Users} />
        <StatCard label="Waitlist (Pending)" value={stats?.waitlist_pending ?? 0} icon={ClipboardList} />
        <StatCard label="Active (7d)" value={stats?.active_users_7d ?? 0} icon={Activity} />
        <StatCard label="Calls Today" value={stats?.calls_today ?? 0} icon={Phone} />
        <StatCard label="Monthly Cost" value={`$${(stats?.monthly_cost ?? 0).toFixed(2)}`} icon={DollarSign} />
        <StatCard label="Active Subs" value={stats?.active_subscriptions ?? 0} icon={CreditCard} />
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

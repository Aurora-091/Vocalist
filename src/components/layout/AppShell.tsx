import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  Megaphone,
  Phone,
  Users,
  Plug,
  TrendingUp,
  CreditCard,
  Settings,
  LogOut,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const items = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/outcomes", label: "Outcomes", icon: TrendingUp },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const navigate = useNavigate();
  const [usage, setUsage] = useState<{ used: number; included: number } | null>(null);
  const [orgName, setOrgName] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const u = await api<any>(`/v1/analytics/usage?period=${today}`);
        setUsage({
          used: Math.round(Number(u.used_minutes) || 0),
          included: Number(u.included_minutes) || 0,
        });
      } catch {
        /* not signed in or no usage yet */
      }
      try {
        const o = await api<any>("/v1/settings/org");
        setOrgName(o.org?.name || "");
      } catch {}
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  const pct = usage && usage.included ? (usage.used / usage.included) * 100 : 0;
  const usageTone =
    pct >= 100 ? "text-danger" : pct >= 80 ? "text-warning" : "text-text-muted";

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="h-14 px-5 flex items-center border-b border-border">
          <div className="font-semibold tracking-tight">Aurora</div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-text-muted hover:text-text hover:bg-surface-2"
                }`
              }
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="m-3 flex items-center gap-3 px-3 py-2 rounded-md text-sm text-text-muted hover:text-text hover:bg-surface-2"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-6">
          <div className="text-sm text-text-muted truncate">
            {orgName || "Your organization"}
          </div>
          <div className="flex items-center gap-4">
            {usage && (
              <div className={`text-xs font-mono ${usageTone}`}>
                {usage.used} / {usage.included || "—"} min
              </div>
            )}
            <ShieldCheck className="w-4 h-4 text-success" aria-label="Compliance: healthy" />
            <Bell className="w-4 h-4 text-text-muted" />
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-bg">
          <div className="max-w-[1280px] mx-auto px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
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
  ShieldCheck,
  Volume2,
  Sun,
  Moon,
  Monitor,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "../../lib/supabase";
import { useEffect, useState } from "react";
import { getUsageSummary, getOrg } from "../../lib/db";
import { NotificationsBell } from "./NotificationsBell";

const items = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/voices", label: "Voices", icon: Volume2 },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/outcomes", label: "Outcomes", icon: TrendingUp },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return (
    <button
      onClick={() => setTheme(next)}
      className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
      aria-label={`Switch to ${next} theme`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <>
      <div className="h-14 px-5 flex items-center border-b border-border">
        <div className="font-semibold tracking-tight">Aurora</div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={onNavigate}
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
        onClick={() => { signOut(); onNavigate?.(); }}
        className="m-3 flex items-center gap-3 px-3 py-2 rounded-md text-sm text-text-muted hover:text-text hover:bg-surface-2"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </>
  );
}

export function AppShell() {
  const [usage, setUsage] = useState<{ used: number; included: number } | null>(null);
  const [orgName, setOrgName] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    (async () => {
      try {
        const u = await getUsageSummary();
        if (u) {
          setUsage({
            used: Math.round(u.used_minutes),
            included: u.included_minutes,
          });
        }
      } catch {}
      try {
        const o = await getOrg();
        setOrgName(o?.name || "");
      } catch {}
    })();
  }, []);

  const pct = usage && usage.included ? (usage.used / usage.included) * 100 : 0;
  const usageTone =
    pct >= 100 ? "text-danger" : pct >= 80 ? "text-warning" : "text-text-muted";

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-border bg-surface flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border flex flex-col transform transition-transform duration-200 ease-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-text-muted truncate">
              {orgName || "Your organization"}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {usage && (
              <div className={`text-xs font-mono ${usageTone} hidden sm:block`}>
                {usage.used} / {usage.included || "—"} min
              </div>
            )}
            <ShieldCheck className="w-4 h-4 text-success hidden sm:block" aria-label="Compliance: healthy" />
            <ThemeToggle />
            <NotificationsBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-bg">
          <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-6 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

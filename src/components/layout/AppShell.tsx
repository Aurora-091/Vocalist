import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Bot, Megaphone, Phone, Users, Plug, TrendingUp, ChartBar as BarChart2, BookOpen, CreditCard, Settings, LogOut, ShieldCheck, Volume2, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "../../lib/supabase";
import { useEffect, useState } from "react";
import { getUsageSummary, getOrg } from "../../lib/db";
import { NotificationsBell } from "./NotificationsBell";
import { WeeberLogo } from "../WeeberLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";

const items = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/voices", label: "Voices", icon: Volume2 },
  { to: "/knowledge", label: "Knowledge", icon: BookOpen },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/analytics", label: "Analytics", icon: BarChart2 },
  { to: "/outcomes", label: "Outcomes", icon: TrendingUp },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Switch theme">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => setTheme(o.value)}>
            <o.icon className="h-4 w-4" />
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppSidebar() {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <Sidebar>
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-4">
        <WeeberLogo size="sm" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.to}>
                  <NavLink to={it.to} end={it.end}>
                    {({ isActive }) => (
                      <SidebarMenuButton asChild isActive={isActive} tooltip={it.label}>
                        <span>
                          <it.icon aria-hidden="true" />
                          <span>{it.label}</span>
                        </span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut aria-hidden="true" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell() {
  const [usage, setUsage] = useState<{ used: number; included: number } | null>(null);
  const [orgName, setOrgName] = useState<string>("");

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
    pct >= 100 ? "text-destructive" : pct >= 80 ? "text-warning" : "text-muted-foreground";

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AppSidebar />
      <SidebarInset>
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <div className="text-sm text-muted-foreground truncate">
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
            <a
              href="mailto:support@weeber.ai"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Help
            </a>
            <ThemeToggle />
            <NotificationsBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-background">
          <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-6 md:py-8">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

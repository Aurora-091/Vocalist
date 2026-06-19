import { Outlet, NavLink, useNavigate, Link } from "react-router-dom";
import { LogOut, ShieldCheck, Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "../../lib/supabase";
import { Suspense, useEffect, useState } from "react";
import { PageSkeleton } from "./PageSkeleton";
import { getUsageSummary, getOrg } from "../../lib/db";
import { NotificationsBell } from "./NotificationsBell";
import { VerticalProvider, useVertical } from "../../lib/VerticalContext";
import type { NavGroup } from "../../config/verticals";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

function NavItems({ items }: { items: NavGroup["items"] }) {
  return (
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
  );
}

function SidebarNavGroup({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(group.defaultOpen ?? true);

  if (group.collapsible) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <SidebarGroup>
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel className="cursor-pointer hover:text-foreground transition-colors">
              {group.label}
              <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent>
              <NavItems items={group.items} />
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <NavItems items={group.items} />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function AppSidebar() {
  const navigate = useNavigate();
  const { config } = useVertical();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  const VerticalIcon = config.icon;

  return (
    <Sidebar collapsible="icon" aria-label="Main navigation">
      <SidebarHeader className="h-14 justify-center px-3">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          <img
            src="/weeber_favicon_transparent.png"
            alt="Weeber"
            className="h-7 w-7 object-contain dark:invert flex-shrink-0"
          />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1 group-data-[collapsible=icon]:hidden">
            <VerticalIcon className="h-3 w-3" />
            {config.shortLabel}
          </span>
        </NavLink>
      </SidebarHeader>
      <SidebarContent>
        {config.navigation.map((group) => (
          <SidebarNavGroup key={group.label} group={group} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {config.footerNav.map((it) => (
            <SidebarMenuItem key={it.to}>
              <NavLink to={it.to}>
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
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sign out">
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
    <VerticalProvider>
      <TooltipProvider delayDuration={0}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header role="banner" className="h-14 bg-background flex items-center justify-between px-4 md:px-6">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
                <div className="text-sm text-muted-foreground truncate">
                  {orgName || "Your organization"}
                </div>
              </div>
              <nav aria-label="Quick actions" className="flex items-center gap-2 md:gap-4">
                {usage && (
                  <div className={`text-xs font-mono ${usageTone} hidden sm:block`}>
                    {usage.used} / {usage.included || "\u2014"} min
                  </div>
                )}
                <ShieldCheck className="w-4 h-4 text-success hidden sm:block" aria-label="Compliance: healthy" />
                <Link
                  to="/about"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
                >
                  About
                </Link>
                <a
                  href="mailto:support@weeber.ai"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
                >
                  Help
                </a>
                <ThemeToggle />
                <NotificationsBell />
              </nav>
            </header>
            <main id="main-content" aria-label="Page content" className="flex-1 overflow-auto bg-background">
              <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-6 md:py-8">
                <Suspense fallback={<PageSkeleton />}>
                  <Outlet />
                </Suspense>
              </div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </VerticalProvider>
  );
}

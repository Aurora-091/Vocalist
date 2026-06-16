import { Outlet, NavLink, useNavigate, Link } from "react-router-dom";
import { LayoutDashboard, Users, ClipboardList, Bot, CreditCard, ScrollText, Headset, Settings, ChartBar as BarChart3, ArrowLeft, LogOut } from "lucide-react";
import { supabase } from "../../lib/supabase";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const coreItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/waitlist", label: "Waitlist", icon: ClipboardList },
  { to: "/admin/agents", label: "Agents", icon: Bot },
];

const financeItems = [
  { to: "/admin/billing", label: "Billing", icon: CreditCard },
];

const opsItems = [
  { to: "/admin/logs", label: "Logs", icon: ScrollText },
  { to: "/admin/support", label: "Support", icon: Headset },
];

const insightItems = [
  { to: "/admin/analytics/product", label: "Product", icon: BarChart3 },
  { to: "/admin/analytics/marketing", label: "Marketing", icon: BarChart3 },
  { to: "/admin/analytics/revenue", label: "Revenue", icon: BarChart3 },
];

const systemItems = [
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function NavGroup({ label, items }: { label: string; items: typeof coreItems }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
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
  );
}

function AdminSidebar() {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-3">
        <NavLink to="/admin" className="flex items-center gap-2">
          <img
            src="/weeber_favicon_transparent.png"
            alt="Weeber Admin"
            className="h-7 w-7 object-contain dark:invert flex-shrink-0"
          />
          <Badge variant="secondary" className="text-[10px] font-bold tracking-wider uppercase group-data-[collapsible=icon]:hidden">
            Admin
          </Badge>
        </NavLink>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Core" items={coreItems} />
        <NavGroup label="Finance" items={financeItems} />
        <NavGroup label="Operations" items={opsItems} />
        <NavGroup label="Analytics" items={insightItems} />
        <NavGroup label="System" items={systemItems} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to App">
              <Link to="/dashboard">
                <ArrowLeft aria-hidden="true" />
                <span>Back to App</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
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

export function AdminShell() {
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <header className="h-14 bg-background flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <span className="text-sm font-medium text-foreground">Platform Admin</span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Exit Admin
              </Link>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

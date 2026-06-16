import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { adminApi } from "@/lib/admin-api";
import { AdminShell } from "@/apps/admin/layouts/AdminShell";

const AdminLogin = lazy(() => import("@/apps/admin/pages/AdminLogin"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminWaitlist = lazy(() => import("@/pages/admin/AdminWaitlist"));
const AdminBroadcasts = lazy(() => import("@/pages/admin/AdminBroadcasts"));
const AdminAgents = lazy(() => import("@/pages/admin/AdminAgents"));
const AdminBilling = lazy(() => import("@/pages/admin/AdminBilling"));
const AdminLogs = lazy(() => import("@/pages/admin/AdminLogs"));
const AdminSupport = lazy(() => import("@/pages/admin/AdminSupport"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const ProductAnalytics = lazy(() => import("@/pages/admin/analytics/ProductAnalytics"));
const MarketingAnalytics = lazy(() => import("@/pages/admin/analytics/MarketingAnalytics"));
const RevenueAnalytics = lazy(() => import("@/pages/admin/analytics/RevenueAnalytics"));

function PageLoader() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 bg-[#0A0A0A]">
      <img
        src="/weeber_favicon_transparent.png"
        alt="Loading"
        className="h-8 w-8 object-contain invert animate-pulse"
      />
    </div>
  );
}

function RequireAdminAuth({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "authorized" | "denied" | "unauthenticated">("loading");

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (mounted) setStatus("unauthenticated");
        return;
      }

      try {
        const res = await adminApi.checkAccess();
        if (!mounted) return;
        setStatus(res.platform_role === "super_admin" ? "authorized" : "denied");
      } catch {
        if (mounted) setStatus("denied");
      }
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (!session) setStatus("unauthenticated");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") return <PageLoader />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;

  if (status === "denied") {
    supabase.auth.signOut();
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminPublicOnly({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setStatus(data.session ? "in" : "out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setStatus(session ? "in" : "out");
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") return <PageLoader />;
  if (status === "in") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function AdminApp() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<AdminPublicOnly><AdminLogin /></AdminPublicOnly>} />

        <Route element={<RequireAdminAuth><AdminShell /></RequireAdminAuth>}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="waitlist" element={<AdminWaitlist />} />
          <Route path="broadcasts" element={<AdminBroadcasts />} />
          <Route path="agents" element={<AdminAgents />} />
          <Route path="billing" element={<AdminBilling />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="support" element={<AdminSupport />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="analytics/product" element={<ProductAnalytics />} />
          <Route path="analytics/marketing" element={<MarketingAnalytics />} />
          <Route path="analytics/revenue" element={<RevenueAnalytics />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

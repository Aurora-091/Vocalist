import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { isAdminApp } from "@/lib/hostname";
import "./index.css";

const AdminApp = lazy(() => import("@/apps/admin/AdminApp"));
const CustomerApp = lazy(() => import("@/apps/customer/CustomerApp"));

function AppLoader() {
  return (
    <div className="h-screen flex items-center justify-center">
      <img
        src="/weeber_favicon_transparent.png"
        alt="Loading"
        width={32}
        height={32}
        className="h-8 w-8 object-contain dark:invert animate-pulse"
      />
    </div>
  );
}

import { AnalyticsLoader } from "@/components/AnalyticsLoader";
import { SpeedInsights } from "@vercel/speed-insights/react";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider attribute="class" defaultTheme="system" storageKey="weeber-theme">
        <TooltipProvider delayDuration={150}>
          <AnalyticsLoader />
          <Suspense fallback={<AppLoader />}>
            {isAdminApp ? <AdminApp /> : <CustomerApp />}
          </Suspense>
          <Toaster richColors closeButton position="top-right" />
          <SpeedInsights />
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isAdminApp } from "@/lib/hostname";
import * as Sentry from "@sentry/react";
import "./index.css";

const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || "https://99e6a4a1148f9d7b9fc9e7157d9b4c68@o4511590961840128.ingest.us.sentry.io/4511699508068352";

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

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
import { Analytics } from "@vercel/analytics/react";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider attribute="class" defaultTheme="system" storageKey="weeber-theme">
        <TooltipProvider delayDuration={150}>
          <AnalyticsLoader />
          <ErrorBoundary>
            <Suspense fallback={<AppLoader />}>
              {isAdminApp ? <AdminApp /> : <CustomerApp />}
            </Suspense>
          </ErrorBoundary>
          <Toaster richColors closeButton position="top-right" />
          <SpeedInsights />
          <Analytics />
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

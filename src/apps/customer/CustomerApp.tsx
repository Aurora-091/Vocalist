import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth, PublicOnly } from "@/components/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { isAppDomain, appUrl, marketingUrl } from "@/lib/hostname";

const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AgentsList = lazy(() => import("@/pages/AgentsList"));
const AgentDetail = lazy(() => import("@/pages/AgentDetail"));
const Campaigns = lazy(() => import("@/pages/Campaigns"));
const CampaignNew = lazy(() => import("@/pages/CampaignNew"));
const CampaignDetail = lazy(() => import("@/pages/CampaignDetail"));
const Calls = lazy(() => import("@/pages/Calls"));
const Contacts = lazy(() => import("@/pages/Contacts"));
const Integrations = lazy(() => import("@/pages/Integrations"));
const Outcomes = lazy(() => import("@/pages/Outcomes"));
const Billing = lazy(() => import("@/pages/Billing"));
const Settings = lazy(() => import("@/pages/Settings"));
const SetupNumberPage = lazy(() => import("@/pages/SetupNumber"));
const Numbers = lazy(() => import("@/pages/Numbers"));
const VoiceLibrary = lazy(() => import("@/pages/VoiceLibrary"));
const ShopifyConnect = lazy(() => import("@/pages/ShopifyConnect"));
const IntegrationConnect = lazy(() => import("@/pages/IntegrationConnect"));
const OAuthCallback = lazy(() => import("@/pages/auth/OAuthCallback"));
const AuthBridge = lazy(() => import("@/pages/auth/AuthBridge"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Knowledge = lazy(() => import("@/pages/Knowledge"));
const About = lazy(() => import("@/pages/About"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const Terms = lazy(() => import("@/pages/Terms"));
const Waitlist = lazy(() => import("@/pages/Waitlist"));

function PageLoader() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-3">
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

function RedirectToApp() {
  window.location.href = appUrl("/dashboard");
  return null;
}

function RedirectToMarketing() {
  window.location.href = marketingUrl("/");
  return null;
}

export default function CustomerApp() {
  if (isAppDomain) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/auth/bridge" element={<AuthBridge />} />
          <Route path="/auth/callback/:provider" element={<OAuthCallback />} />

          <Route path="/login" element={<RedirectToMarketing />} />
          <Route path="/signup" element={<RedirectToMarketing />} />

          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <Onboarding />
              </RequireAuth>
            }
          />

          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/agents" element={<AgentsList />} />
            <Route path="/agents/:id" element={<AgentDetail />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/new" element={<CampaignNew />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/calls" element={<Calls />} />
            <Route path="/numbers" element={<Numbers />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/integrations/numbers" element={<SetupNumberPage />} />
            <Route path="/integrations/shopify" element={<ShopifyConnect />} />
            <Route path="/integrations/connect/:provider" element={<IntegrationConnect />} />
            <Route path="/voices" element={<VoiceLibrary />} />
            <Route path="/outcomes" element={<Outcomes />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // Marketing domain (weeber.ai) — public pages only
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Waitlist />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
        <Route path="/auth/callback/:provider" element={<OAuthCallback />} />
        <Route path="/auth/bridge" element={<AuthBridge />} />

        {/* Redirect app routes to app domain */}
        <Route path="/dashboard" element={<RedirectToApp />} />
        <Route path="/agents" element={<RedirectToApp />} />
        <Route path="/onboarding" element={<RedirectToApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

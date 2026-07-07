import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth, PublicOnly } from "@/components/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";

import Waitlist from "@/pages/Waitlist";
import About from "@/pages/About";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import Terms from "@/pages/Terms";

const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const VerifyEmail = lazy(() => import("@/pages/auth/VerifyEmail"));
const AuthCallback = lazy(() => import("@/pages/auth/AuthCallback"));
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
const Analytics = lazy(() => import("@/pages/Analytics"));
const Knowledge = lazy(() => import("@/pages/Knowledge"));
const Playbooks = lazy(() => import("@/pages/Playbooks"));
const NotFound = lazy(() => import("@/pages/NotFound"));

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

export default function CustomerApp() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public / marketing */}
        <Route path="/" element={<Waitlist />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />

        {/* Auth */}
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
        <Route path="/auth/verify" element={<PublicOnly><VerifyEmail /></PublicOnly>} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/callback/:provider" element={<OAuthCallback />} />

        {/* Onboarding redirects to dashboard (modal opens automatically) */}
        <Route path="/onboarding" element={<Navigate to="/dashboard?welcome=1" replace />} />

        {/* App (authenticated) */}
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
          <Route path="/playbooks" element={<Playbooks />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

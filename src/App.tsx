import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { RequireAuth, PublicOnly } from "./components/RequireAuth";
import { AppShell } from "./components/layout/AppShell";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AgentsList = lazy(() => import("./pages/AgentsList"));
const AgentDetail = lazy(() => import("./pages/AgentDetail"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const CampaignNew = lazy(() => import("./pages/CampaignNew"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const Calls = lazy(() => import("./pages/Calls"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Outcomes = lazy(() => import("./pages/Outcomes"));
const Billing = lazy(() => import("./pages/Billing"));
const Settings = lazy(() => import("./pages/Settings"));
const SetupNumberPage = lazy(() => import("./pages/SetupNumber"));
const VoiceLibrary = lazy(() => import("./pages/VoiceLibrary"));
const ShopifyConnect = lazy(() => import("./pages/ShopifyConnect"));
const IntegrationConnect = lazy(() => import("./pages/IntegrationConnect"));
const OAuthCallback = lazy(() => import("./pages/auth/OAuthCallback"));
const About = lazy(() => import("./pages/About"));
const Story = lazy(() => import("./pages/Story"));
const Funding = lazy(() => import("./pages/Funding"));
const Demo = lazy(() => import("./pages/Demo"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Terms = lazy(() => import("./pages/Terms"));

function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-text-muted">
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/welcome" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/story" element={<Story />} />
        <Route path="/funding" element={<Funding />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
        <Route path="/auth/callback/:provider" element={<OAuthCallback />} />
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
          <Route path="/" element={<Dashboard />} />
          <Route path="/agents" element={<AgentsList />} />
          <Route path="/agents/:id" element={<AgentDetail />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/new" element={<CampaignNew />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/calls" element={<Calls />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/integrations/numbers" element={<SetupNumberPage />} />
          <Route path="/integrations/shopify" element={<ShopifyConnect />} />
          <Route path="/integrations/connect/:provider" element={<IntegrationConnect />} />
          <Route path="/voices" element={<VoiceLibrary />} />
          <Route path="/outcomes" element={<Outcomes />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

import { Routes, Route } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { AppShell } from "./components/layout/AppShell";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";

import Dashboard from "./pages/Dashboard";
import AgentsList from "./pages/AgentsList";
import AgentDetail from "./pages/AgentDetail";
import Campaigns from "./pages/Campaigns";
import CampaignNew from "./pages/CampaignNew";
import CampaignDetail from "./pages/CampaignDetail";
import Calls from "./pages/Calls";
import Contacts from "./pages/Contacts";
import Integrations from "./pages/Integrations";
import Outcomes from "./pages/Outcomes";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import SetupNumberPage from "./pages/SetupNumber";

export default function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
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
        <Route path="/outcomes" element={<Outcomes />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

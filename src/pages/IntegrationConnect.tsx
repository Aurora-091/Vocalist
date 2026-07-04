import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ShoppingBag, MessageCircle, Calendar, Table, CircleDot,
  GitBranch, Sparkles, Database, Cloud, Stethoscope,
  HeartPulse, Activity, CalendarCheck, Plug,
} from "lucide-react";
import { getIntegrationCatalogEntry, getBridgeConfig, upsertBridgeConfig } from "../lib/db";
import { supabase } from "../lib/supabase";
import { IntegrationConnectWizard, type FieldConfig, type WizardStep } from "../components/IntegrationConnectWizard";
import { Skeleton } from "@/components/ui/skeleton";

const ICON_MAP: Record<string, React.ElementType> = {
  "shopping-bag": ShoppingBag,
  "message-circle": MessageCircle,
  calendar: Calendar,
  table: Table,
  "circle-dot": CircleDot,
  "git-branch": GitBranch,
  sparkles: Sparkles,
  database: Database,
  cloud: Cloud,
  stethoscope: Stethoscope,
  "heart-pulse": HeartPulse,
  activity: Activity,
  "calendar-check": CalendarCheck,
};

const PROVIDER_FIELDS: Record<string, FieldConfig[]> = {
  whatsapp: [
    { key: "account_sid", label: "Twilio Account SID", placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "text", required: true },
    { key: "auth_token", label: "Twilio Auth Token", placeholder: "your_auth_token", type: "password", required: true },
    { key: "whatsapp_number", label: "WhatsApp Number", placeholder: "+14155238886", type: "text", helpText: "Your Twilio WhatsApp-enabled number", required: true },
  ],
  pipedrive: [
    { key: "api_token", label: "API Token", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password", required: true },
    { key: "domain", label: "Company Domain", placeholder: "yourcompany", type: "text", helpText: "Your Pipedrive subdomain (e.g. yourcompany.pipedrive.com)", required: true },
  ],
  freshsales: [
    { key: "api_key", label: "API Key", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx", type: "password", required: true },
    { key: "domain", label: "Domain", placeholder: "yourcompany", type: "text", helpText: "Your Freshsales subdomain (e.g. yourcompany.freshsales.io)", required: true },
  ],
  cliniko: [
    { key: "api_key", label: "API Key", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password", required: true, helpText: "Found in Cliniko > Settings > Integrations > API Keys" },
  ],
  jane_app: [
    { key: "api_key", label: "API Key", placeholder: "xxxxxxxxxxxxxxxx", type: "password", required: true },
    { key: "domain", label: "Practice Domain", placeholder: "yourpractice", type: "text", helpText: "Your Jane subdomain (e.g. yourpractice.janeapp.com)", required: true },
  ],
  calcom: [
    { key: "api_key", label: "API Key", placeholder: "cal_live_xxxxxxxxxxxxxxxxxxxxxxxx", type: "password", required: true, helpText: "Found in Cal.com > Settings > Developer > API Keys" },
  ],
  hubspot: [],
  google_cal: [],
  google_sheets: [],
  zoho_crm: [],
  salesforce: [],
  drchrono: [],
};

const ADMIN_URLS: Record<string, (config?: Record<string, string>) => string> = {
  pipedrive: (c) => `https://${c?.domain || "app"}.pipedrive.com/settings/api`,
  freshsales: (c) => `https://${c?.domain || "app"}.freshsales.io/personal-settings/api-settings`,
  cliniko: () => "https://app.cliniko.com/account/integrations",
  jane_app: (c) => `https://${c?.domain || "app"}.janeapp.com/settings/integrations`,
  calcom: () => "https://app.cal.com/settings/developer/api-keys",
  whatsapp: () => "https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn",
};

export default function IntegrationConnect() {
  const { provider } = useParams<{ provider: string }>();
  const navigate = useNavigate();
  const [catalogEntry, setCatalogEntry] = useState<any | null>(null);
  const [existingConfig, setExistingConfig] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!provider) return;
    (async () => {
      try {
        const [entry, config] = await Promise.all([
          getIntegrationCatalogEntry(provider),
          getBridgeConfig(provider),
        ]);
        setCatalogEntry(entry);
        setExistingConfig(config);
      } catch {
        navigate("/integrations");
      } finally {
        setLoading(false);
      }
    })();
  }, [provider]);

  if (loading || !catalogEntry) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const Icon = ICON_MAP[catalogEntry.icon_key] || Plug;
  const isOAuth = catalogEntry.auth_type === "oauth2";
  const fields = PROVIDER_FIELDS[provider!] || [
    { key: "api_key", label: "API Key", placeholder: "Enter your API key", type: "password" as const, required: true },
  ];

  const steps: WizardStep[] = isOAuth
    ? [
        { key: "auth", label: "Authorize" },
        { key: "done", label: "Done" },
      ]
    : [
        { key: "instructions", label: "Setup" },
        { key: "credentials", label: "Credentials" },
        { key: "done", label: "Done" },
      ];

  async function handleSubmit(values: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    try {
      const config: Record<string, any> = {};
      const secretFields = ["api_key", "auth_token", "api_token"];
      let secretValue = "";

      for (const [key, val] of Object.entries(values)) {
        if (!secretFields.includes(key)) {
          config[key] = val;
        } else {
          secretValue = val;
        }
      }

      const secretRef = `vault_${provider}_${Date.now()}`;
      if (secretValue) {
        const { error: vaultError } = await supabase.rpc("vault_store", {
          name: secretRef,
          secret: secretValue,
        });
        if (vaultError) throw vaultError;
      }

      if (provider === "whatsapp") {
        const { data, error } = await supabase.functions.invoke("agent-bridge", {
          body: {
            provider: "whatsapp",
            action: "send_message",
            params: { to: values.whatsapp_number, body: "Weeber connection test" },
          },
        });

        if (error && !error.message?.includes("not configured")) {
          // Ignore — we're just setting up
        }
      }

      await upsertBridgeConfig(provider!, {
        status: "active",
        config,
        secret_ref: secretValue ? secretRef : undefined,
        scopes_granted: catalogEntry.scopes || [],
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Connection failed" };
    }
  }

  function handleOAuth() {
    const redirectBase = window.location.origin;
    const csrf = crypto.randomUUID();
    sessionStorage.setItem("oauth_csrf_state", csrf);
    const state = btoa(JSON.stringify({ provider: provider!, redirect: "/integrations", csrf, ts: Date.now() }));

    if (provider === "google_cal" || provider === "google_sheets") {
      const scopes = (catalogEntry.scopes || []).join(" ");
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_PLACEHOLDER";
      const redirectUri = `${redirectBase}/auth/callback/google`;
      const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`;
      window.location.href = url;
    } else if (provider === "hubspot") {
      const clientId = import.meta.env.VITE_HUBSPOT_CLIENT_ID || "HUBSPOT_CLIENT_ID_PLACEHOLDER";
      const redirectUri = `${redirectBase}/auth/callback/hubspot`;
      const scopes = (catalogEntry.scopes || []).join(" ");
      const url = `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`;
      window.location.href = url;
    } else if (provider === "zoho_crm") {
      const clientId = import.meta.env.VITE_ZOHO_CLIENT_ID || "ZOHO_CLIENT_ID_PLACEHOLDER";
      const redirectUri = `${redirectBase}/auth/callback/zoho`;
      const scopes = (catalogEntry.scopes || []).join(",");
      const url = `https://accounts.zoho.com/oauth/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&access_type=offline&state=${state}`;
      window.location.href = url;
    } else if (provider === "salesforce") {
      const clientId = import.meta.env.VITE_SALESFORCE_CLIENT_ID || "SALESFORCE_CLIENT_ID_PLACEHOLDER";
      const redirectUri = `${redirectBase}/auth/callback/salesforce`;
      const url = `https://login.salesforce.com/services/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
      window.location.href = url;
    } else if (provider === "drchrono") {
      const clientId = import.meta.env.VITE_DRCHRONO_CLIENT_ID || "DRCHRONO_CLIENT_ID_PLACEHOLDER";
      const redirectUri = `${redirectBase}/auth/callback/drchrono`;
      const url = `https://drchrono.com/o/authorize/?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
      window.location.href = url;
    }
  }

  const adminUrl = ADMIN_URLS[provider!]?.(existingConfig?.config);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connect {catalogEntry.name}</h1>
        <p className="text-sm text-text-muted mt-1">{catalogEntry.description}</p>
      </div>

      {existingConfig?.status === "active" ? (
        <div className="bg-surface border border-success/30 rounded-md p-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-success/10 text-success flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </span>
            <div>
              <div className="font-medium">{catalogEntry.name} is connected</div>
              <div className="text-xs text-text-muted mt-0.5">
                Connected {existingConfig.connected_at ? new Date(existingConfig.connected_at).toLocaleDateString() : ""}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => navigate("/integrations")}
              className="text-sm text-text-muted hover:text-text transition-colors"
            >
              Back to integrations
            </button>
          </div>
        </div>
      ) : (
        <IntegrationConnectWizard
          providerName={catalogEntry.name}
          providerIcon={<Icon className="w-5 h-5" />}
          authType={catalogEntry.auth_type}
          steps={steps}
          setupInstructions={catalogEntry.setup_instructions || []}
          fields={fields}
          adminUrl={adminUrl}
          onSubmit={handleSubmit}
          onOAuth={isOAuth ? handleOAuth : undefined}
          onComplete={() => navigate("/integrations")}
          onBack={() => navigate("/integrations")}
        />
      )}
    </div>
  );
}

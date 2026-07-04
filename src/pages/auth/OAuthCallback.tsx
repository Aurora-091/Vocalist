import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader, Check, CircleAlert } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { upsertBridgeConfig } from "../../lib/db";
import { Button } from "../../components/legacy-ui/Button";

const OAUTH_STATE_SECRET = import.meta.env.VITE_OAUTH_STATE_SECRET || "";

async function signState(stateRaw: string): Promise<string> {
  const keyData = new TextEncoder().encode(OAUTH_STATE_SECRET);
  const msgData = new TextEncoder().encode(stateRaw);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, msgData);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [providerName, setProviderName] = useState("Integration");

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      const code = searchParams.get("code");
      const stateRaw = searchParams.get("state");
      const errorParam = searchParams.get("error");

      if (errorParam) {
        setError(`Authorization denied: ${errorParam}`);
        setStatus("error");
        return;
      }

      if (!code || !stateRaw) {
        setError("Missing authorization code or state");
        setStatus("error");
        return;
      }

      let state: { provider: string; redirect: string; csrf?: string; ts?: number };
      try {
        state = JSON.parse(atob(stateRaw));
      } catch {
        setError("Invalid state parameter");
        setStatus("error");
        return;
      }

      const storedCsrf = sessionStorage.getItem("oauth_csrf_state");
      sessionStorage.removeItem("oauth_csrf_state");

      if (!state.csrf || state.csrf !== storedCsrf) {
        setError("OAuth state validation failed (CSRF check). Request rejected.");
        setStatus("error");
        return;
      }

      setProviderName(state.provider.replace(/_/g, " "));

      const hmac = await signState(stateRaw);

      const { data, error: fnError } = await supabase.functions.invoke("oauth-exchange", {
        body: {
          code,
          provider: state.provider,
          redirect_uri: `${window.location.origin}${window.location.pathname}`,
          state: stateRaw,
          hmac,
        },
      });

      if (fnError) throw new Error(fnError.message || "Token exchange failed");
      if (data?.error) throw new Error(data.error);

      await upsertBridgeConfig(state.provider, {
        status: "active",
        scopes_granted: data?.scopes || [],
      });

      setStatus("success");
      setTimeout(() => navigate(state.redirect || "/integrations"), 2000);
    } catch (err: any) {
      setError(err.message || "OAuth callback failed");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="bg-surface border border-border rounded-md shadow-card p-8 max-w-sm w-full text-center">
        {status === "loading" && (
          <>
            <Loader className="w-8 h-8 text-primary animate-spin mx-auto" />
            <div className="mt-4 font-medium">Completing authorization...</div>
            <p className="mt-1 text-sm text-text-muted">Exchanging token with {providerName}</p>
          </>
        )}

        {status === "success" && (
          <>
            <span className="w-14 h-14 rounded-full bg-success/10 text-success inline-flex items-center justify-center mb-4">
              <Check className="w-7 h-7" />
            </span>
            <div className="font-medium text-lg">Connected!</div>
            <p className="mt-2 text-sm text-text-muted">Redirecting you back...</p>
          </>
        )}

        {status === "error" && (
          <>
            <span className="w-14 h-14 rounded-full bg-danger/10 text-danger inline-flex items-center justify-center mb-4">
              <CircleAlert className="w-7 h-7" />
            </span>
            <div className="font-medium text-lg">Connection failed</div>
            <p className="mt-2 text-sm text-text-muted">{error}</p>
            <Button className="mt-6" onClick={() => navigate("/integrations")}>
              Back to integrations
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

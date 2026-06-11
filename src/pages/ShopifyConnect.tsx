import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, ExternalLink, Check, Loader as Loader2, CircleAlert as AlertCircle, ArrowRight } from "lucide-react";
import { getShopifyConnection, createShopifyConnection, updateShopifyConnection } from "../lib/db";
import { supabase } from "../lib/supabase";
import { Button } from "../components/legacy-ui/Button";
import { Badge } from "../components/legacy-ui/Badge";

type Step = "domain" | "instructions" | "key" | "validating" | "done";

export default function ShopifyConnect() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("domain");
  const [domain, setDomain] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const conn = await getShopifyConnection();
      if (conn) {
        setConnection(conn);
        setDomain(conn.shop_domain);
        if (conn.status === "active") setStep("done");
      }
    })();
  }, []);

  function normalizeDomain(input: string): string {
    let d = input.trim().toLowerCase();
    d = d.replace(/^https?:\/\//, "");
    d = d.replace(/\/$/, "");
    if (!d.includes(".myshopify.com") && !d.includes(".")) {
      d = `${d}.myshopify.com`;
    }
    return d;
  }

  async function handleDomainSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeDomain(domain);
    setDomain(normalized);
    setStep("instructions");
  }

  function openShopifyAdmin() {
    const adminUrl = `https://${domain}/admin/settings/apps/development`;
    window.open(adminUrl, "_blank", "noopener");
  }

  async function validateAndConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStep("validating");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("shopify-connect", {
        body: { shop_domain: domain, api_key: apiKey },
      });

      if (fnError) throw new Error(fnError.message || "Connection failed");
      if (data?.error) throw new Error(data.error);

      let conn = connection;
      if (!conn) {
        conn = await createShopifyConnection({ shop_domain: domain });
      }

      await updateShopifyConnection(conn.id, {
        status: "active",
        api_key_ref: data?.key_ref || "vault_ref",
        last_sync_at: new Date().toISOString(),
      });

      setConnection({ ...conn, status: "active" });
      setStep("done");
    } catch (err: any) {
      setError(err.message || "Failed to validate API key. Check the key and try again.");
      setStep("key");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connect Shopify</h1>
        <p className="text-sm text-text-muted mt-1">
          Link your Shopify store so agents can access orders, carts, and customer data.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {(["domain", "instructions", "key", "done"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full text-xs font-medium inline-flex items-center justify-center ${
                step === s || (s === "done" && step === "validating")
                  ? "bg-primary text-primary-foreground"
                  : (["domain", "instructions", "key", "done"].indexOf(step === "validating" ? "key" : step) > i)
                  ? "bg-success/15 text-success"
                  : "bg-surface-2 text-text-muted"
              }`}
            >
              {(["domain", "instructions", "key", "done"].indexOf(step === "validating" ? "key" : step) > i) ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                i + 1
              )}
            </span>
            {i < 3 && <span className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
        {step === "domain" && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-md bg-[#96BF48]/10 text-[#96BF48] flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </span>
              <div>
                <div className="font-medium">Your Shopify store</div>
                <div className="text-xs text-text-muted">Enter your store domain to get started</div>
              </div>
            </div>
            <form onSubmit={handleDomainSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Store domain
                </label>
                <input
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="mystore.myshopify.com"
                  className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm"
                />
                <p className="mt-1.5 text-xs text-text-muted">
                  Your .myshopify.com domain or custom domain
                </p>
              </div>
              <Button type="submit" disabled={!domain.trim()}>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          </div>
        )}

        {step === "instructions" && (
          <div className="p-6 space-y-5">
            <div className="font-medium">Get your Admin API access token</div>
            <div className="bg-surface-2 rounded-md p-4 space-y-3">
              <div className="text-sm space-y-2">
                <div className="flex gap-2">
                  <span className="font-mono text-xs text-text-muted bg-surface border border-border w-5 h-5 rounded flex items-center justify-center shrink-0">1</span>
                  <span>Click the button below to open your Shopify admin</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-mono text-xs text-text-muted bg-surface border border-border w-5 h-5 rounded flex items-center justify-center shrink-0">2</span>
                  <span>Go to <strong>Apps and sales channels</strong> &gt; <strong>Develop apps</strong></span>
                </div>
                <div className="flex gap-2">
                  <span className="font-mono text-xs text-text-muted bg-surface border border-border w-5 h-5 rounded flex items-center justify-center shrink-0">3</span>
                  <span>Create a new app (or select existing) and configure <strong>Admin API</strong> scopes: <code className="text-xs bg-surface px-1 py-0.5 rounded">read_orders, read_customers, read_checkouts, read_products</code></span>
                </div>
                <div className="flex gap-2">
                  <span className="font-mono text-xs text-text-muted bg-surface border border-border w-5 h-5 rounded flex items-center justify-center shrink-0">4</span>
                  <span>Install the app and copy the <strong>Admin API access token</strong></span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={openShopifyAdmin}>
                Open Shopify Admin
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
              <Button variant="secondary" onClick={() => setStep("key")}>
                I have my token
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === "key" && (
          <div className="p-6">
            <div className="font-medium mb-1">Paste your Admin API access token</div>
            <p className="text-xs text-text-muted mb-4">
              Connecting to <span className="font-mono">{domain}</span>
            </p>
            <form onSubmit={validateAndConnect} className="space-y-4">
              <div>
                <input
                  required
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm font-mono"
                />
                <p className="mt-1.5 text-xs text-text-muted">
                  Starts with <code>shpat_</code>. Stored encrypted, never displayed again.
                </p>
              </div>
              {error && (
                <div className="flex items-start gap-2 text-sm text-danger">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <Button type="submit" disabled={!apiKey.trim() || loading}>
                  {loading ? "Validating..." : "Connect store"}
                </Button>
                <Button variant="ghost" onClick={() => setStep("instructions")}>
                  Back
                </Button>
              </div>
            </form>
          </div>
        )}

        {step === "validating" && (
          <div className="p-6 flex flex-col items-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <div className="mt-4 font-medium">Validating connection...</div>
            <p className="mt-1 text-sm text-text-muted">
              Checking API access to {domain}
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="p-6 text-center py-12">
            <span className="w-14 h-14 rounded-full bg-success/10 text-success inline-flex items-center justify-center mb-4">
              <Check className="w-7 h-7" />
            </span>
            <div className="font-medium text-lg">Shopify connected</div>
            <p className="mt-2 text-sm text-text-muted">
              <span className="font-mono">{domain}</span> is now linked to Aurora.
              Your agents can access orders, carts, and customer data.
            </p>
            <div className="mt-4">
              <Badge tone="success" dot>Active</Badge>
            </div>
            <div className="mt-8 flex justify-center gap-3">
              <Button onClick={() => navigate("/agents")}>
                Create an agent
              </Button>
              <Button variant="secondary" onClick={() => navigate("/integrations")}>
                Back to integrations
              </Button>
            </div>
          </div>
        )}
      </div>

      {step !== "done" && (
        <div className="bg-surface-2 rounded-md p-4">
          <div className="text-xs font-medium text-text-muted mb-1">What happens after connecting?</div>
          <ul className="text-xs text-text-muted space-y-1">
            <li>Your agents can look up orders, carts, and customers during calls</li>
            <li>Data is cached locally for sub-50ms access during conversations</li>
            <li>API key is encrypted and stored securely (never visible after saving)</li>
            <li>You can disconnect at any time from Settings</li>
          </ul>
        </div>
      )}
    </div>
  );
}

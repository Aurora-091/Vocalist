import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingBag, Check, Loader as Loader2, ArrowRight, ExternalLink, RefreshCw, Users, Settings } from "lucide-react";
import { getShopifyIntegration, getOrgId } from "../lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "../lib/api";

type Step = "domain" | "redirecting" | "done";

interface ShopStats {
  product_count?: number;
  order_count_30d?: number;
  customer_count?: number;
  shop_name?: string;
}

const WEEBERSH_INSTALL_URL =
  import.meta.env.VITE_WEEBERSH_INSTALL_URL || "https://weebersh.com/api/auth";

export default function ShopifyConnect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("domain");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [shopDomain, setShopDomain] = useState("");
  const [shopStats, setShopStats] = useState<ShopStats>({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const shopifyParam = searchParams.get("shopify");
      const integration = await getShopifyIntegration();

      if (integration?.status === "active") {
        setShopDomain(integration.config?.shop_domain || "");
        setShopStats({
          shop_name: integration.config?.shop_name,
          product_count: integration.config?.stats?.product_count,
          order_count_30d: integration.config?.stats?.order_count_30d,
          customer_count: integration.config?.stats?.customer_count,
        });
        setStep("done");
      } else if (shopifyParam === "connected") {
        const refreshed = await getShopifyIntegration();
        if (refreshed?.status === "active") {
          setShopDomain(refreshed.config?.shop_domain || "");
          setShopStats({
            shop_name: refreshed.config?.shop_name,
            product_count: refreshed.config?.stats?.product_count,
            order_count_30d: refreshed.config?.stats?.order_count_30d,
            customer_count: refreshed.config?.stats?.customer_count,
          });
          setStep("done");
        }
      }
      setLoading(false);
    })();
  }, [searchParams]);

  async function handleSyncContacts() {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const result = await api.post<{ synced: number; note?: string }>("/v1/integrations/shopify/sync-contacts");
      setSyncResult({ synced: result.synced ?? 0 });
    } catch (err: any) {
      setSyncError(err?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function normalizeDomain(input: string): string {
    let d = input.trim().toLowerCase();
    d = d.replace(/^https?:\/\//, "");
    d = d.replace(/\/$/, "");
    if (!d.includes(".myshopify.com") && !d.includes(".")) {
      d = `${d}.myshopify.com`;
    }
    return d;
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeDomain(domain);
    setDomain(normalized);
    setStep("redirecting");

    const orgId = await getOrgId();
    const redirectUrl = `${window.location.origin}/integrations/shopify?shopify=connected`;
    const installUrl = `${WEEBERSH_INSTALL_URL}?shop=${encodeURIComponent(normalized)}&org_id=${orgId || ""}&redirect_url=${encodeURIComponent(redirectUrl)}`;
    window.location.href = installUrl;
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connect Shopify</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Link your Shopify store so agents can access orders, carts, and customer data.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {(["domain", "done"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full text-xs font-medium inline-flex items-center justify-center ${
                step === s || (s === "done" && step === "redirecting")
                  ? "bg-primary text-primary-foreground"
                  : step === "done" && i === 0
                  ? "bg-success/15 text-success"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step === "done" && i === 0 ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                i + 1
              )}
            </span>
            {i < 1 && <span className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-md shadow-card overflow-hidden">
        {step === "domain" && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-md bg-[#96BF48]/10 text-[#96BF48] flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </span>
              <div>
                <div className="font-medium">Connect your Shopify store</div>
                <div className="text-xs text-muted-foreground">Enter your store domain to authorize Weeber</div>
              </div>
            </div>
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Store domain
                </label>
                <input
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="mystore.myshopify.com"
                  className="w-full h-10 px-3 rounded-md border border-border bg-card text-sm"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Your .myshopify.com domain or custom domain
                </p>
              </div>
              <Button type="submit" disabled={!domain.trim()}>
                Connect with Shopify
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </form>
          </div>
        )}

        {step === "redirecting" && (
          <div className="p-6 flex flex-col items-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <div className="mt-4 font-medium">Redirecting to Shopify...</div>
            <p className="mt-1 text-sm text-muted-foreground">
              You'll be asked to authorize Weeber in your Shopify admin
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <span className="w-12 h-12 rounded-full bg-success/10 text-success inline-flex items-center justify-center shrink-0">
                <Check className="w-6 h-6" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-base">
                  {shopStats.shop_name || "Shopify store"} connected
                </div>
                {shopDomain && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{shopDomain}</p>
                )}
              </div>
              <Badge variant="secondary" className="bg-success/15 text-success shrink-0">
                <span className="size-1.5 rounded-full bg-current mr-1" />Active
              </Badge>
            </div>

            {(shopStats.customer_count != null || shopStats.order_count_30d != null || shopStats.product_count != null) && (
              <div className="grid grid-cols-3 gap-3">
                {shopStats.customer_count != null && (
                  <div className="bg-muted rounded-md px-3 py-2.5 text-center">
                    <div className="text-lg font-semibold font-mono">{shopStats.customer_count.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Customers</div>
                  </div>
                )}
                {shopStats.order_count_30d != null && (
                  <div className="bg-muted rounded-md px-3 py-2.5 text-center">
                    <div className="text-lg font-semibold font-mono">{shopStats.order_count_30d.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Orders (30d)</div>
                  </div>
                )}
                {shopStats.product_count != null && (
                  <div className="bg-muted rounded-md px-3 py-2.5 text-center">
                    <div className="text-lg font-semibold font-mono">{shopStats.product_count.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Products</div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">Actions</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSyncContacts}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Sync customers
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate("/contacts")}>
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  View contacts
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate("/integrations/playbooks")}>
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  Configure playbooks
                </Button>
              </div>
              {syncResult && (
                <p className="text-xs text-success mt-1.5" role="status" aria-live="polite">
                  Synced {syncResult.synced} customer{syncResult.synced !== 1 ? "s" : ""} successfully.
                </p>
              )}
              {syncError && (
                <p className="text-xs text-destructive mt-1.5" role="alert">{syncError}</p>
              )}
            </div>

            <div className="border-t border-border pt-4 flex gap-2">
              <Button onClick={() => navigate("/agents")}>
                Create an agent
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button variant="secondary" onClick={() => navigate("/integrations")}>
                Back to integrations
              </Button>
            </div>
          </div>
        )}
      </div>

      {step === "domain" && (
        <div className="bg-muted rounded-md p-4">
          <div className="text-xs font-medium text-muted-foreground mb-1">What happens after connecting?</div>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>You'll authorize Weeber in your Shopify admin (takes 30 seconds)</li>
            <li>Your agents can look up orders, carts, and customers during calls</li>
            <li>Abandoned checkout events trigger automated recovery calls</li>
            <li>You can disconnect at any time from Settings</li>
          </ul>
        </div>
      )}
    </div>
  );
}

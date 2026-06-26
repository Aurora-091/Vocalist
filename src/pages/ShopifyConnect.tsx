import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingBag, Check, Loader as Loader2, ArrowRight, ExternalLink } from "lucide-react";
import { getShopifyIntegration, getOrgId } from "../lib/db";
import { Button } from "../components/legacy-ui/Button";
import { Badge } from "../components/legacy-ui/Badge";
import { toast } from "sonner";

type Step = "domain" | "redirecting" | "done";

const WEEBERSH_INSTALL_URL =
  import.meta.env.VITE_WEEBERSH_INSTALL_URL || "https://weebersh.com/api/auth";

export default function ShopifyConnect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("domain");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [shopDomain, setShopDomain] = useState("");

  useEffect(() => {
    (async () => {
      const shopifyParam = searchParams.get("shopify");
      const integration = await getShopifyIntegration();

      if (integration?.status === "active") {
        setShopDomain(integration.config?.shop_domain || "");
        setStep("done");
      } else if (shopifyParam === "connected") {
        const refreshed = await getShopifyIntegration();
        if (refreshed?.status === "active") {
          setShopDomain(refreshed.config?.shop_domain || "");
          setStep("done");
        }
      }
      setLoading(false);
    })();
  }, [searchParams]);

  function normalizeDomain(input: string): string {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return "";

    // Strip scheme and isolate host by removing path, port, query, fragment
    const withoutScheme = trimmed.replace(/^https?:\/\//, "");
    const host = withoutScheme.split(/[/?#:]/)[0];

    // Accept exactly "myshopify.com" or ending with ".myshopify.com"
    if (host === "myshopify.com" || host.endsWith(".myshopify.com")) {
      return host;
    }

    // Bare store name: single DNS label containing only alphanumeric and hyphens
    const isValidSingleLabel = /^[a-z0-9-]+$/.test(host);
    if (!host.includes(".") && isValidSingleLabel) {
      return `${host}.myshopify.com`;
    }

    return "";
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeDomain(domain);
    if (!normalized) {
      toast.error("Please enter a valid Shopify store domain.");
      return;
    }
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
        <p className="text-sm text-text-muted mt-1">
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
                  : "bg-surface-2 text-text-muted"
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

      <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
        {step === "domain" && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-md bg-[#96BF48]/10 text-[#96BF48] flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </span>
              <div>
                <div className="font-medium">Connect your Shopify store</div>
                <div className="text-xs text-text-muted">Enter your store domain to authorize Weeber</div>
              </div>
            </div>
            <form onSubmit={handleConnect} className="space-y-4">
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
            <p className="mt-1 text-sm text-text-muted">
              You'll be asked to authorize Weeber in your Shopify admin
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
              {shopDomain && <span className="font-mono">{shopDomain}</span>}
              {shopDomain ? " is now linked to Weeber. " : ""}
              Your agents can access orders, carts, and customer data.
            </p>
            <div className="mt-4">
              <Badge tone="success" dot>Active</Badge>
            </div>
            <div className="mt-8 flex justify-center gap-3">
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
        <div className="bg-surface-2 rounded-md p-4">
          <div className="text-xs font-medium text-text-muted mb-1">What happens after connecting?</div>
          <ul className="text-xs text-text-muted space-y-1">
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

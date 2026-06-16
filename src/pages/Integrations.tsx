import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShoppingBag,
  MessageCircle,
  Calendar,
  Table,
  CircleDot,
  GitBranch,
  Sparkles,
  Database,
  Cloud,
  Stethoscope,
  HeartPulse,
  Activity,
  CalendarCheck,
  Search,
  Check,
  Plug,
  ExternalLink,
  Filter,
} from "lucide-react";
import {
  listIntegrationCatalog,
  listBridgeConfigs,
  getOrg,
} from "../lib/db";
import { Button } from "../components/legacy-ui/Button";
import { Badge } from "../components/legacy-ui/Badge";
import { Skeleton } from "../components/legacy-ui/States";

type CatalogEntry = {
  id: string;
  provider_key: string;
  name: string;
  description: string;
  icon_key: string;
  category: string;
  auth_type: string;
  verticals: string[];
  tier_required: string;
  sort_order: number;
};

type BridgeConfig = {
  id: string;
  provider_key: string;
  status: string;
  connected_at: string | null;
};

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

const CATEGORY_LABELS: Record<string, string> = {
  ecommerce: "E-Commerce",
  messaging: "Messaging",
  calendar: "Calendar & Scheduling",
  spreadsheet: "Data Export",
  crm: "CRM",
  ehr: "Healthcare / EHR",
  automation: "Automation",
  telephony: "Telephony",
};

const VERTICAL_LABELS: Record<string, string> = {
  ecommerce: "E-Commerce",
  retail: "Retail",
  clinic: "Healthcare",
  services: "Services",
};

const TABS = [
  { key: "recommended", label: "Recommended" },
  { key: "all", label: "All integrations" },
  { key: "connected", label: "Connected" },
];

export default function Integrations() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [connections, setConnections] = useState<BridgeConfig[]>([]);
  const [orgVertical, setOrgVertical] = useState<string | null>(null);
  const [tab, setTab] = useState("recommended");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    (async () => {
      const [cat, conns, org] = await Promise.all([
        listIntegrationCatalog(),
        listBridgeConfigs(),
        getOrg(),
      ]);
      setCatalog(cat);
      setConnections(conns);
      const vKey = org?.vertical_config_id ? await getVerticalKey(org.vertical_config_id) : null;
      setOrgVertical(vKey);
    })();
  }, []);

  async function getVerticalKey(verticalId: string) {
    try {
      const { supabase } = await import("../lib/supabase");
      const { data } = await supabase
        .from("vertical_configs")
        .select("key")
        .eq("id", verticalId)
        .single();
      return data?.key || null;
    } catch {
      return null;
    }
  }

  const connectedSet = new Map(
    connections
      .filter((c) => c.status === "active")
      .map((c) => [c.provider_key, c])
  );

  function getFilteredCatalog(): CatalogEntry[] {
    if (!catalog) return [];
    let items = [...catalog];

    if (tab === "connected") {
      items = items.filter((c) => connectedSet.has(c.provider_key));
    } else if (tab === "recommended" && orgVertical) {
      items = items.filter((c) => c.verticals.includes(orgVertical));
    }

    if (categoryFilter) {
      items = items.filter((c) => c.category === categoryFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      );
    }

    return items;
  }

  const filteredCatalog = getFilteredCatalog();
  const categories = catalog ? [...new Set(catalog.map((c) => c.category))] : [];

  function getProviderRoute(providerKey: string): string {
    if (providerKey === "shopify") return "/integrations/shopify";
    return `/integrations/connect/${providerKey}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-sm text-text-muted mt-1">
            Connect your tools so agents can access live data during calls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info">{connections.filter((c) => c.status === "active").length} connected</Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-text text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t.label}
            {t.key === "connected" && connections.filter((c) => c.status === "active").length > 0 && (
              <span className="ml-1.5 text-xs bg-surface-2 text-text-muted border border-border px-1.5 py-0.5 rounded-full">
                {connections.filter((c) => c.status === "active").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search integrations..."
            className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-surface text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-border bg-surface text-sm"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {catalog === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : filteredCatalog.length === 0 ? (
        <div className="text-center py-16">
          <Plug className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <div className="text-sm text-text-muted">
            {tab === "connected"
              ? "No integrations connected yet."
              : "No integrations match your filters."}
          </div>
          {tab === "connected" && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setTab("all")}>
              Browse all integrations
            </Button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCatalog.map((entry) => {
            const Icon = ICON_MAP[entry.icon_key] || Plug;
            const isConnected = connectedSet.has(entry.provider_key);
            const route = getProviderRoute(entry.provider_key);

            return (
              <Link
                key={entry.id}
                to={route}
                className={`group bg-surface border rounded-md p-5 shadow-card transition-all hover:border-text/20 hover:shadow-md ${
                  isConnected ? "border-success/30" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="w-10 h-10 rounded-md bg-surface-2 border border-border text-text-muted flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="flex items-center gap-2">
                    {isConnected && (
                      <Badge tone="success" dot>Active</Badge>
                    )}
                    {entry.tier_required !== "starter" && !isConnected && (
                      <Badge tone="warning">{entry.tier_required}</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="font-medium flex items-center gap-2">
                    {entry.name}
                    <ExternalLink className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="mt-1.5 text-sm text-text-muted leading-relaxed line-clamp-2">
                    {entry.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-text-muted bg-surface-2 px-2 py-0.5 rounded">
                    {CATEGORY_LABELS[entry.category] || entry.category}
                  </span>
                  <span className="text-xs text-text-muted">
                    {entry.auth_type === "oauth2" ? "One-click" : "API key"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

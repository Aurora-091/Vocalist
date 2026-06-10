import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingBag,
  Stethoscope,
  Calendar,
  Phone,
  BookOpen,
  Plus,
  Check,
} from "lucide-react";
import {
  listIntegrations,
  listKnowledgeSources,
  listPhoneNumbers,
  createKnowledgeSource,
  getShopifyConnection,
} from "../lib/db";
import { Button } from "../components/legacy-ui/Button";
import { Card, CardBody } from "../components/legacy-ui/Card";
import { Badge } from "../components/legacy-ui/Badge";
import { Skeleton } from "../components/legacy-ui/States";

type Integration = {
  id: string;
  provider: string;
  status: string;
  created_at: string;
};

const TILES = [
  { provider: "shopify", label: "Shopify", icon: ShoppingBag, copy: "Sync customers and abandoned carts." },
  { provider: "hubspot", label: "HubSpot", icon: Stethoscope, copy: "Two-way contact sync and call notes." },
  { provider: "calcom", label: "Cal.com", icon: Calendar, copy: "Book directly to your team's calendar." },
  { provider: "google", label: "Google Calendar", icon: Calendar, copy: "Read availability and create events." },
];

export default function Integrations() {
  const [installed, setInstalled] = useState<Integration[] | null>(null);
  const [sources, setSources] = useState<any[] | null>(null);
  const [numbers, setNumbers] = useState<any[] | null>(null);
  const [shopifyConn, setShopifyConn] = useState<any>(null);

  async function load() {
    const [i, k, n, sc] = await Promise.all([
      listIntegrations(),
      listKnowledgeSources(),
      listPhoneNumbers(),
      getShopifyConnection(),
    ]);
    setInstalled(i);
    setSources(k);
    setNumbers(n);
    setShopifyConn(sc);
  }

  useEffect(() => {
    load();
  }, []);

  const installedSet = new Set((installed || []).map((i) => i.provider));
  const shopifyActive = shopifyConn?.status === "active" || installedSet.has("shopify");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-text-muted mt-1">
          Connect tools, sources, and phone numbers.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-text-muted uppercase tracking-widest mb-3">
          Tools
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TILES.map((t) => {
            const isOn = t.provider === "shopify" ? shopifyActive : installedSet.has(t.provider);
            const linkTo = t.provider === "shopify" ? "/integrations/shopify" : undefined;
            const card = (
              <div
                className="bg-surface border border-border rounded-md p-5 shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <t.icon className="w-4 h-4" />
                  </span>
                  {isOn && (
                    <Badge tone="success" dot>
                      connected
                    </Badge>
                  )}
                </div>
                <div className="mt-4 font-medium">{t.label}</div>
                <p className="mt-1 text-sm text-text-muted">{t.copy}</p>
                <div className="mt-4">
                  <Button variant={isOn ? "secondary" : "primary"} size="sm">
                    {isOn ? "Manage" : "Connect"}
                  </Button>
                </div>
              </div>
            );
            if (linkTo) {
              return <Link key={t.provider} to={linkTo}>{card}</Link>;
            }
            return <div key={t.provider}>{card}</div>;
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-widest">
            Phone numbers
          </h2>
        </div>
        <Card>
          <CardBody>
            {numbers === null ? (
              <Skeleton className="h-16" />
            ) : numbers.length === 0 ? (
              <div className="text-sm text-text-muted">
                No numbers yet. Numbers are provisioned through the Twilio integration
                once your account is connected.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {numbers.map((n) => (
                  <div
                    key={n.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-text-muted" />
                      <div>
                        <div className="font-mono text-sm">{n.e164}</div>
                        <div className="text-xs text-text-muted">
                          {n.byo ? "BYO" : "Aurora-managed"} · {n.status || "active"}
                        </div>
                      </div>
                    </div>
                    {n.agent_id ? (
                      <Badge tone="info">bound</Badge>
                    ) : (
                      <Badge tone="neutral">unassigned</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-widest">
            Knowledge sources
          </h2>
          <AddKnowledge onAdded={load} />
        </div>
        <Card>
          <CardBody>
            {sources === null ? (
              <Skeleton className="h-16" />
            ) : sources.length === 0 ? (
              <div className="text-sm text-text-muted">
                Add a website or document. Aurora will use it for grounded answers.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sources.map((s) => (
                  <div
                    key={s.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-4 h-4 text-text-muted" />
                      <div>
                        <div className="text-sm font-medium">{s.title || s.uri}</div>
                        <div className="text-xs text-text-muted">
                          {s.kind} · {s.status}
                        </div>
                      </div>
                    </div>
                    <Badge
                      tone={
                        s.status === "ready"
                          ? "success"
                          : s.status === "failed"
                          ? "danger"
                          : "info"
                      }
                    >
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function AddKnowledge({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [uri, setUri] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      await createKnowledgeSource({ kind: "website", uri, title });
      onAdded();
      setOpen(false);
      setUri("");
      setTitle("");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-2" />
        Add source
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="FAQ"
        className="h-9 px-3 rounded-md border border-border bg-surface text-sm w-32"
      />
      <input
        value={uri}
        onChange={(e) => setUri(e.target.value)}
        placeholder="https://example.com/faq"
        className="h-9 px-3 rounded-md border border-border bg-surface text-sm w-72"
      />
      <Button size="sm" onClick={add} disabled={busy || !uri || !title}>
        <Check className="w-4 h-4 mr-1" />
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

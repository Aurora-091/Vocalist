import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/States";

const TABS = ["Organization", "Compliance", "Notifications", "Webhooks"] as const;
type Tab = typeof TABS[number];

export default function Settings() {
  const [tab, setTab] = useState<Tab>("Organization");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-text-muted mt-1">
          Org details, compliance, notifications, and webhooks.
        </p>
      </div>

      <div className="border-b border-border flex gap-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 -mb-px border-b-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Organization" && <OrgPanel />}
      {tab === "Compliance" && <CompliancePanel />}
      {tab === "Notifications" && <NotificationsPanel />}
      {tab === "Webhooks" && <WebhooksPanel />}
    </div>
  );
}

function OrgPanel() {
  const [org, setOrg] = useState<any>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await api<{ org: any }>("/v1/settings/org");
      setOrg(r.org);
      setName(r.org?.name || "");
    })();
  }, []);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await api("/v1/settings/org", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  if (!org) return <Skeleton className="h-32" />;

  return (
    <Card>
      <CardHeader>
        <div className="font-medium">Organization</div>
      </CardHeader>
      <CardBody>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Organization name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-surface"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={busy || !name}>
              {busy ? "Saving…" : "Save"}
            </Button>
            {saved && <span className="text-sm text-success">Saved.</span>}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function CompliancePanel() {
  return (
    <Card>
      <CardHeader>
        <div className="font-medium">Compliance</div>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-text-muted">
          Aurora enforces consent on every outbound dial. Opt-outs propagate
          immediately. Use the contacts page to inspect consent and the GDPR
          tools to export or erase a contact.
        </p>
      </CardBody>
    </Card>
  );
}

function NotificationsPanel() {
  const [prefs, setPrefs] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ prefs: any }>("/v1/settings/notification-prefs");
        setPrefs(
          r.prefs || {
            usage_alerts: true,
            failed_calls: true,
            campaign_completed: true,
          }
        );
      } catch {
        setPrefs({
          usage_alerts: true,
          failed_calls: true,
          campaign_completed: true,
        });
      }
    })();
  }, []);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await api("/v1/settings/notification-prefs", {
        method: "PUT",
        body: JSON.stringify(prefs),
      });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  if (!prefs) return <Skeleton className="h-32" />;

  return (
    <Card>
      <CardHeader>
        <div className="font-medium">Notifications</div>
      </CardHeader>
      <CardBody>
        <div className="space-y-3">
          <Toggle
            label="Usage alerts"
            value={!!prefs.usage_alerts}
            onChange={(v) => setPrefs({ ...prefs, usage_alerts: v })}
          />
          <Toggle
            label="Failed calls"
            value={!!prefs.failed_calls}
            onChange={(v) => setPrefs({ ...prefs, failed_calls: v })}
          />
          <Toggle
            label="Campaign completed"
            value={!!prefs.campaign_completed}
            onChange={(v) => setPrefs({ ...prefs, campaign_completed: v })}
          />
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            {saved && <span className="text-sm text-success">Saved.</span>}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
          value ? "bg-primary" : "bg-surface-2"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-4" : ""
          }`}
        />
      </button>
    </label>
  );
}

function WebhooksPanel() {
  const [hooks, setHooks] = useState<any[] | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api<{ webhooks: any[] }>("/v1/webhooks-out");
      setHooks(r.webhooks || []);
    } catch {
      setHooks([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    setBusy(true);
    try {
      await api("/v1/webhooks-out", {
        method: "POST",
        body: JSON.stringify({
          url,
          events: ["call.completed", "call.failed"],
        }),
      });
      setUrl("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="font-medium">Webhooks</div>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-text-muted mb-4">
          We sign every event with HMAC-SHA256 in the <code className="font-mono">X-Aurora-Signature</code> header.
        </p>
        <div className="flex gap-2 mb-4">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your.app/webhook"
            className="flex-1 h-10 px-3 rounded-md border border-border bg-surface text-sm"
          />
          <Button onClick={add} disabled={busy || !url}>
            {busy ? "Adding…" : "Add endpoint"}
          </Button>
        </div>
        {hooks === null ? (
          <Skeleton className="h-16" />
        ) : hooks.length === 0 ? (
          <div className="text-sm text-text-muted">No endpoints yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {hooks.map((h) => (
              <div key={h.id} className="py-3">
                <div className="font-mono text-sm">{h.url}</div>
                <div className="text-xs text-text-muted mt-1">
                  Events: {(h.events || []).join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

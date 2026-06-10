import { useEffect, useState } from "react";
import {
  getOrg,
  updateOrg,
  getNotificationPrefs,
  updateNotificationPrefs,
  listWebhookEndpoints,
  createWebhookEndpoint,
} from "../lib/db";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { Button } from "../components/legacy-ui/Button";
import { Skeleton } from "../components/legacy-ui/States";

const TABS = ["Organization", "Compliance", "Notifications", "Webhooks"] as const;
type Tab = (typeof TABS)[number];

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
  const [org, setOrgData] = useState<any>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const o = await getOrg();
      setOrgData(o);
      setName(o?.name || "");
    })();
  }, []);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await updateOrg({ name });
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="font-medium">Compliance posture</div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-text-muted">
            Aurora enforces consent on every outbound dial. Opt-outs propagate
            instantly across active campaigns. Recording disclosure is part of
            every outbound persona by default.
          </p>
          <div className="mt-4 grid sm:grid-cols-3 gap-4">
            <div className="border border-border rounded-md p-4">
              <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Consent gate</div>
              <div className="text-sm font-medium text-success">Active</div>
            </div>
            <div className="border border-border rounded-md p-4">
              <div className="text-xs uppercase tracking-widest text-text-muted mb-1">DNC enforcement</div>
              <div className="text-sm font-medium text-success">Active</div>
            </div>
            <div className="border border-border rounded-md p-4">
              <div className="text-xs uppercase tracking-widest text-text-muted mb-1">Recording disclosure</div>
              <div className="text-sm font-medium text-success">Auto-prepended</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-medium">GDPR / data subject requests</div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-text-muted">
            Use the Compliance API to export or erase contact data. Look up by phone
            number. Export returns contact, consent, and call history as JSON. Erase
            revokes consent, deletes contact data, and adds the number to your DNC list.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function NotificationsPanel() {
  const [prefs, setPrefs] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await getNotificationPrefs();
      setPrefs(p || { usage_alerts: true, failed_calls: true, campaign_completed: true });
    })();
  }, []);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await updateNotificationPrefs(prefs);
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
    setHooks(await listWebhookEndpoints());
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    setBusy(true);
    try {
      await createWebhookEndpoint({
        url,
        events: ["call.completed", "call.failed"],
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

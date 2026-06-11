import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Trash2, LogOut } from "lucide-react";
import {
  getOrg,
  updateOrg,
  getNotificationPrefs,
  updateNotificationPrefs,
  listWebhookEndpoints,
  createWebhookEndpoint,
} from "../lib/db";
import { supabase, getSession } from "../lib/supabase";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { Button } from "../components/legacy-ui/Button";
import { Skeleton } from "../components/legacy-ui/States";
import { toast } from "sonner";

const TABS = ["Profile", "Organization", "Appearance", "Security", "Notifications", "Webhooks", "Compliance"] as const;
type Tab = (typeof TABS)[number];

export default function Settings() {
  const [tab, setTab] = useState<Tab>("Profile");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-text-muted mt-1">
          Manage your account, organization, and preferences.
        </p>
      </div>

      <div className="border-b border-border flex gap-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 -mb-px border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t
                ? "border-text text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Profile" && <ProfilePanel />}
      {tab === "Organization" && <OrgPanel />}
      {tab === "Appearance" && <AppearancePanel />}
      {tab === "Security" && <SecurityPanel />}
      {tab === "Notifications" && <NotificationsPanel />}
      {tab === "Webhooks" && <WebhooksPanel />}
      {tab === "Compliance" && <CompliancePanel />}
    </div>
  );
}

function ProfilePanel() {
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) return;
      setEmail(session.email || "");
      const { data } = await supabase
        .from("users")
        .select("display_name, timezone")
        .eq("id", session.user_id)
        .maybeSingle();
      if (data) {
        setDisplayName(data.display_name || "");
        setTimezone(data.timezone || "UTC");
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setBusy(true);
    const session = await getSession();
    if (!session) return;
    const { error } = await supabase
      .from("users")
      .update({ display_name: displayName, timezone })
      .eq("id", session.user_id);
    setBusy(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated");
    }
  }

  if (loading) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardHeader>
        <div className="font-medium">Your Profile</div>
      </CardHeader>
      <CardBody>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-surface"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Email</label>
            <input
              value={email}
              readOnly
              className="w-full h-10 px-3 rounded-md border border-border bg-surface-2 text-text-muted cursor-not-allowed"
            />
            <p className="text-xs text-text-muted mt-1">Managed by your auth provider.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-surface"
            >
              {Intl.supportedValuesOf("timeZone").map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving..." : "Save profile"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function AppearancePanel() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
    { key: "system", label: "System", icon: Monitor },
  ] as const;

  async function saveTheme(newTheme: string) {
    setTheme(newTheme);
    const session = await getSession();
    if (session) {
      await supabase
        .from("users")
        .update({ theme_preference: newTheme })
        .eq("id", session.user_id);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="font-medium">Appearance</div>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-text-muted mb-4">
          Choose how Aurora looks for you. This syncs across devices.
        </p>
        <div className="grid grid-cols-3 gap-3 max-w-sm">
          {themes.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => saveTheme(key)}
              className={`flex flex-col items-center gap-2 p-4 rounded-md border transition-colors ${
                theme === key
                  ? "border-text bg-surface-2 text-text"
                  : "border-border hover:border-text/30 text-text-muted hover:text-text"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function SecurityPanel() {
  const [sessions, setSessions] = useState<any[] | null>(null);
  const [changingPw, setChangingPw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    const session = await getSession();
    if (!session) return;
    const { data } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", session.user_id)
      .is("revoked_at", null)
      .order("last_active_at", { ascending: false });
    setSessions(data || []);
  }

  async function revokeSession(id: string) {
    await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Session revoked");
    loadSessions();
  }

  async function revokeAllOthers() {
    const session = await getSession();
    if (!session) return;
    const currentSessionId = sessions?.[0]?.id;
    if (!currentSessionId) return;
    const { error } = await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", session.user_id)
      .neq("id", currentSessionId)
      .is("revoked_at", null);
    if (!error) {
      toast.success("All other sessions revoked");
      loadSessions();
    }
  }

  async function changePassword() {
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated");
      setChangingPw(false);
      setCurrentPw("");
      setNewPw("");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="font-medium">Password</div>
        </CardHeader>
        <CardBody>
          {!changingPw ? (
            <Button variant="secondary" onClick={() => setChangingPw(true)}>
              Change password
            </Button>
          ) : (
            <div className="space-y-3 max-w-sm">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">New password</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  minLength={8}
                  className="w-full h-10 px-3 rounded-md border border-border bg-surface"
                  placeholder="8+ characters"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={changePassword} disabled={pwBusy || newPw.length < 8}>
                  {pwBusy ? "Updating..." : "Update password"}
                </Button>
                <Button variant="secondary" onClick={() => setChangingPw(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="font-medium">Active Sessions</div>
            {sessions && sessions.length > 1 && (
              <button
                onClick={revokeAllOthers}
                className="text-xs text-danger hover:text-danger/80 font-medium"
              >
                Revoke all others
              </button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {sessions === null ? (
            <Skeleton className="h-20" />
          ) : sessions.length === 0 ? (
            <p className="text-sm text-text-muted">No active sessions recorded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {sessions.map((s, i) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      {s.device_info || "Unknown device"}
                      {i === 0 && (
                        <span className="text-xs bg-surface-2 text-text-muted border border-border px-1.5 py-0.5 rounded">Current</span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {s.ip_address || "Unknown IP"} — Last active {new Date(s.last_active_at).toLocaleDateString()}
                    </div>
                  </div>
                  {i !== 0 && (
                    <button
                      onClick={() => revokeSession(s.id)}
                      className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="font-medium text-danger">Danger Zone</div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-text-muted mb-3">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <Button
            variant="secondary"
            onClick={() => toast.error("Contact support to delete your account.")}
            className="border-danger/30 text-danger hover:bg-danger/5"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete account
          </Button>
        </CardBody>
      </Card>
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
              {busy ? "Saving..." : "Save"}
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
              {busy ? "Saving..." : "Save"}
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
            {busy ? "Adding..." : "Add endpoint"}
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

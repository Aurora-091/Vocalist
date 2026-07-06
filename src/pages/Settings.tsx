import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Trash2, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import {
  getOrg,
  updateOrg,
  getNotificationPrefs,
  updateNotificationPrefs,
  listWebhookEndpoints,
  createWebhookEndpoint,
  getUserProfile,
  updateUserProfile,
  updateUserTheme,
  listUserSessions,
  revokeSession,
  revokeAllOtherSessions,
} from "../lib/db";
import { supabase, getSession } from "../lib/supabase";
import { useVertical } from "../lib/VerticalContext";
import { VERTICAL_REGISTRY, listVerticals, type VerticalKey } from "../config/verticals";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const TABS = ["Profile", "Organization", "Playbooks", "Appearance", "Security", "Notifications", "Webhooks", "Compliance"] as const;
type Tab = (typeof TABS)[number];

const PANELS: Record<Tab, React.ComponentType> = {
  Profile: ProfilePanel,
  Organization: OrgPanel,
  Playbooks: PlaybooksPanel,
  Appearance: AppearancePanel,
  Security: SecurityPanel,
  Notifications: NotificationsPanel,
  Webhooks: WebhooksPanel,
  Compliance: CompliancePanel,
};

export default function Settings() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, organization, and preferences.
        </p>
      </div>

      <Tabs defaultValue="Profile">
        <TabsList className="w-full justify-start overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => {
          const Panel = PANELS[t];
          return (
            <TabsContent key={t} value={t}>
              <Panel />
            </TabsContent>
          );
        })}
      </Tabs>
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
      try {
        const data = await getUserProfile(session.user_id);
        if (data) {
          setDisplayName(data.display_name || "");
          setTimezone(data.timezone || "UTC");
        }
      } catch {
        /* ignored */
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setBusy(true);
    const session = await getSession();
    if (!session) {
      setBusy(false);
      return;
    }
    try {
      await updateUserProfile(session.user_id, { display_name: displayName, timezone });
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-48" />;

  return (
    <Card className="gap-0 overflow-visible py-0 shadow-card">
      <div className="border-b px-6 py-4">
        <div className="font-medium">Your Profile</div>
      </div>
      <CardContent className="px-6 py-5">
        <FieldGroup className="max-w-md gap-4">
          <Field>
            <FieldLabel htmlFor="profile-name">Display name</FieldLabel>
            <Input
              id="profile-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-email">Email</FieldLabel>
            <Input id="profile-email" value={email} readOnly disabled />
            <FieldDescription>Managed by your auth provider.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-tz">Timezone</FieldLabel>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="profile-tz" className="w-full">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Intl.supportedValuesOf("timeZone").map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving..." : "Save profile"}
          </Button>
        </FieldGroup>
      </CardContent>
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
      try {
        await updateUserTheme(session.user_id, newTheme);
      } catch {
        /* ignored */
      }
    }
  }

  return (
    <Card className="gap-0 overflow-visible py-0 shadow-card">
      <div className="border-b px-6 py-4">
        <div className="font-medium">Appearance</div>
      </div>
      <CardContent className="px-6 py-5">
        <p className="text-sm text-text-muted mb-4">
          Choose how Weeber looks for you. This syncs across devices.
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
      </CardContent>
    </Card>
  );
}

function SecurityPanel() {
  const [sessions, setSessions] = useState<any[] | null>(null);
  const [changingPw, setChangingPw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    const session = await getSession();
    if (!session) return;
    try {
      const data = await listUserSessions(session.user_id);
      setSessions(data);
    } catch {
      setSessions([]);
    }
  }

  async function handleRevokeSession(id: string) {
    try {
      await revokeSession(id);
      toast.success("Session revoked");
      loadSessions();
    } catch {
      toast.error("Failed to revoke session");
    }
  }

  async function revokeAllOthers() {
    const session = await getSession();
    if (!session) return;
    const currentSessionId = sessions?.[0]?.id;
    try {
      await revokeAllOtherSessions(session.user_id, currentSessionId);
      toast.success("All other sessions revoked");
      loadSessions();
    } catch {
      toast.error("Failed to revoke other sessions");
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
      setNewPw("");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="font-medium">Password</div>
        </div>
        <CardContent className="px-6 py-5">
          {!changingPw ? (
            <Button variant="outline" onClick={() => setChangingPw(true)}>
              Change password
            </Button>
          ) : (
            <div className="flex flex-col gap-3 max-w-sm">
              <Field>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  minLength={8}
                  placeholder="8+ characters"
                />
              </Field>
              <div className="flex gap-2">
                <Button onClick={changePassword} disabled={pwBusy || newPw.length < 8}>
                  {pwBusy ? "Updating..." : "Update password"}
                </Button>
                <Button variant="outline" onClick={() => setChangingPw(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
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
        </div>
        <CardContent className="px-6 py-5">
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
                      onClick={() => handleRevokeSession(s.id)}
                      className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="font-medium text-danger">Danger Zone</div>
        </div>
        <CardContent className="px-6 py-5">
          <p className="text-sm text-text-muted mb-3">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <Button
            variant="outline"
            onClick={() => toast.error("Contact support to delete your account.")}
            className="border-danger/30 text-danger hover:bg-danger/5"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function OrgPanel() {
  const [org, setOrgData] = useState<any>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const { vertical, setVertical } = useVertical();
  const [verticalBusy, setVerticalBusy] = useState(false);

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

  async function handleVerticalChange(key: string) {
    setVerticalBusy(true);
    try {
      await setVertical(key as VerticalKey);
      toast.success(`Workspace switched to ${VERTICAL_REGISTRY[key as VerticalKey].label}`);
    } catch {
      toast.error("Failed to update business type");
    } finally {
      setVerticalBusy(false);
    }
  }

  if (!org) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-6">
      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="font-medium">Organization</div>
        </div>
        <CardContent className="px-6 py-5">
          <FieldGroup className="max-w-md gap-4">
            <Field>
              <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={busy || !name}>
                {busy ? "Saving..." : "Save"}
              </Button>
              {saved && <span className="text-sm text-success">Saved.</span>}
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="font-medium">Business type</div>
        </div>
        <CardContent className="px-6 py-5">
          <p className="text-sm text-text-muted mb-4">
            This controls which agent templates, integrations, and dashboard metrics you see.
            Changing this re-scopes your workspace.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
            {listVerticals().map((v) => {
              const Icon = v.icon;
              const isActive = vertical === v.key;
              return (
                <button
                  key={v.key}
                  onClick={() => !isActive && handleVerticalChange(v.key)}
                  disabled={verticalBusy || !v.enabled}
                  className={`text-left p-4 rounded-md border transition-colors ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : !v.enabled
                      ? "border-border opacity-50 cursor-not-allowed"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{v.label}</span>
                  </div>
                  {!v.enabled && (
                    <span className="text-[10px] text-text-muted mt-1 block">Coming soon</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CompliancePanel() {
  return (
    <div className="space-y-6">
      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="font-medium">Compliance posture</div>
        </div>
        <CardContent className="px-6 py-5">
          <p className="text-sm text-text-muted">
            Weeber enforces consent on every outbound dial. Opt-outs propagate
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
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-visible py-0 shadow-card">
        <div className="border-b px-6 py-4">
          <div className="font-medium">GDPR / data subject requests</div>
        </div>
        <CardContent className="px-6 py-5">
          <p className="text-sm text-text-muted">
            Use the Compliance API to export or erase contact data. Look up by phone
            number. Export returns contact, consent, and call history as JSON. Erase
            revokes consent, deletes contact data, and adds the number to your DNC list.
          </p>
        </CardContent>
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
    <Card className="gap-0 overflow-visible py-0 shadow-card">
      <div className="border-b px-6 py-4">
        <div className="font-medium">Notifications</div>
      </div>
      <CardContent className="px-6 py-5">
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
      </CardContent>
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
      <Switch checked={value} onCheckedChange={onChange} />
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
    <Card className="gap-0 overflow-visible py-0 shadow-card">
      <div className="border-b px-6 py-4">
        <div className="font-medium">Webhooks</div>
      </div>
      <CardContent className="px-6 py-5">
        <p className="text-sm text-text-muted mb-4">
          We sign every event with HMAC-SHA256 in the <code className="font-mono">X-Weeber-Signature</code> header.
        </p>
        <div className="flex gap-2 mb-4">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your.app/webhook"
            aria-label="Webhook endpoint URL"
            className="flex-1"
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
      </CardContent>
    </Card>
  );
}

// ─── Playbooks Panel ─────────────────────────────────────────────────────────

type Playbook = {
  id?: string;
  key: string;
  enabled: boolean;
  agent_id: string | null;
  delay_minutes: number;
  max_attempts: number;
  call_hours_start: number;
  call_hours_end: number;
  timezone: string;
  config: Record<string, unknown>;
};

const PLAYBOOK_META: Record<string, { label: string; description: string; defaultDelay: number }> = {
  cart_recovery: { label: "Cart Recovery", description: "Call customers who abandoned their cart", defaultDelay: 30 },
  cod_confirm: { label: "COD Confirmation", description: "Verify cash-on-delivery orders to reduce RTO", defaultDelay: 5 },
  feedback: { label: "Feedback Collection", description: "Post-delivery satisfaction check and review request", defaultDelay: 2880 },
};

function PlaybooksPanel() {
  const [playbooks, setPlaybooks] = useState<Record<string, Playbook>>({});
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [pbRes, agentsData] = await Promise.all([
          api.get<{ playbooks: Playbook[] }>("/v1/integrations/playbooks"),
          import("@/lib/db").then((m) => m.listAgents()),
        ]);

        const map: Record<string, Playbook> = {};
        for (const key of Object.keys(PLAYBOOK_META)) {
          const existing = pbRes.playbooks.find((p) => p.key === key);
          map[key] = existing || {
            key,
            enabled: true,
            agent_id: null,
            delay_minutes: PLAYBOOK_META[key].defaultDelay,
            max_attempts: 3,
            call_hours_start: 9,
            call_hours_end: 21,
            timezone: "Asia/Kolkata",
            config: {},
          };
        }
        setPlaybooks(map);
        setAgents((agentsData || []).map((a: any) => ({ id: a.id, name: a.name })));
      } catch {
        toast.error("Failed to load playbooks");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function update(key: string, patch: Partial<Playbook>) {
    setPlaybooks((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function save(key: string) {
    setSaving(key);
    try {
      const pb = playbooks[key];
      const { id: _id, ...payload } = pb;
      await api.put(`/v1/integrations/playbooks/${key}`, payload);
      toast.success(`${PLAYBOOK_META[key].label} saved`);
    } catch {
      toast.error("Failed to save playbook");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-6">
      {Object.entries(PLAYBOOK_META).map(([key, meta]) => {
        const pb = playbooks[key];
        if (!pb) return null;
        const isFeedback = key === "feedback";

        return (
          <Card key={key} className="gap-0 overflow-visible py-0 shadow-card">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{meta.label}</div>
                <div className="text-xs text-text-muted mt-0.5">{meta.description}</div>
              </div>
              <Switch
                checked={pb.enabled}
                onCheckedChange={(v) => update(key, { enabled: v })}
              />
            </div>
            <CardContent className="px-6 py-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Agent</FieldLabel>
                  <Select
                    value={pb.agent_id || ""}
                    onValueChange={(v) => update(key, { agent_id: v || null })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>{isFeedback ? "Delay (days)" : "Delay (minutes)"}</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    value={isFeedback ? Math.round(pb.delay_minutes / 1440) : pb.delay_minutes}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      update(key, { delay_minutes: isFeedback ? val * 1440 : val });
                    }}
                  />
                </Field>

                <Field>
                  <FieldLabel>Max retries</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={pb.max_attempts}
                    onChange={(e) => update(key, { max_attempts: parseInt(e.target.value) || 3 })}
                  />
                </Field>

                <Field>
                  <FieldLabel>Calling window</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      className="w-20"
                      value={pb.call_hours_start}
                      onChange={(e) => update(key, { call_hours_start: parseInt(e.target.value) || 9 })}
                    />
                    <span className="text-xs text-text-muted">to</span>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      className="w-20"
                      value={pb.call_hours_end}
                      onChange={(e) => update(key, { call_hours_end: parseInt(e.target.value) || 21 })}
                    />
                  </div>
                  <FieldDescription>Hours ({pb.timezone})</FieldDescription>
                </Field>
              </div>

              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={() => save(key)} disabled={saving === key}>
                  {saving === key ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

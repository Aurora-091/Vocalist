import { useEffect, useState, useCallback } from "react";
import { ShoppingCart, PackageCheck, Star, ChevronDown, ChevronUp, Save, Loader as Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { listAgents } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Playbook = {
  id?: string;
  key: "cart_recovery" | "cod_confirm" | "feedback";
  enabled: boolean;
  agent_id: string | null;
  delay_minutes: number;
  max_attempts: number;
  call_hours_start: number;
  call_hours_end: number;
  timezone: string;
  config: Record<string, any>;
};

type Agent = { id: string; name: string };

const PLAYBOOK_META: Record<
  Playbook["key"],
  { label: string; description: string; icon: React.ElementType; delayLabel: string }
> = {
  cart_recovery: {
    label: "Cart Recovery",
    description: "Call customers who abandoned their cart. Retries until answered or limit reached.",
    icon: ShoppingCart,
    delayLabel: "Delay after abandonment",
  },
  cod_confirm: {
    label: "COD Confirmation",
    description: "Confirm cash-on-delivery orders to reduce RTO. Triggered ~5 min after order.",
    icon: PackageCheck,
    delayLabel: "Delay after order",
  },
  feedback: {
    label: "Post-delivery Feedback",
    description: "Follow up after delivery to capture rating and review consent.",
    icon: Star,
    delayLabel: "Delay after delivery",
  },
};

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
];

function formatDelay(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function Playbooks() {
  const [playbooks, setPlaybooks] = useState<Playbook[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Partial<Playbook>>>({});

  const load = useCallback(async () => {
    const [pb, ag] = await Promise.all([
      api.get<{ playbooks: Playbook[] }>("/v1/playbooks"),
      listAgents(),
    ]);
    setPlaybooks(pb.playbooks || []);
    setAgents(ag || []);
    // Seed drafts from loaded values
    const initial: Record<string, Partial<Playbook>> = {};
    (pb.playbooks || []).forEach((p) => { initial[p.key] = { ...p }; });
    setDrafts(initial);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  function setDraft(key: string, patch: Partial<Playbook>) {
    setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
  }

  async function toggleEnabled(key: Playbook["key"], enabled: boolean) {
    const prev = drafts[key];
    setDraft(key, { enabled });
    try {
      await api.patch(`/v1/playbooks/${key}`, { enabled });
      toast.success(`${PLAYBOOK_META[key].label} ${enabled ? "enabled" : "disabled"}`);
    } catch (e: any) {
      setDrafts((d) => ({ ...d, [key]: prev || {} }));
      toast.error(e?.message || "Failed to update");
    }
  }

  async function save(key: Playbook["key"]) {
    const draft = drafts[key];
    if (!draft) return;
    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await api.patch(`/v1/playbooks/${key}`, draft);
      toast.success(`${PLAYBOOK_META[key].label} saved`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  }

  const keys: Playbook["key"][] = ["cart_recovery", "cod_confirm", "feedback"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Playbooks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure automated call workflows triggered by Shopify events.
        </p>
      </div>

      <div className="space-y-4">
        {playbooks === null
          ? keys.map((k) => <Skeleton key={k} className="h-24 w-full" />)
          : keys.map((key) => {
              const meta = PLAYBOOK_META[key];
              const Icon = meta.icon;
              const draft = drafts[key] || {};
              const isOpen = expanded[key];

              return (
                <Card key={key} className="gap-0 overflow-visible py-0 shadow-card">
                  {/* Header row */}
                  <div className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-sm flex items-center gap-2">
                          {meta.label}
                          {draft.enabled && (
                            <span className="text-[10px] uppercase tracking-widest font-medium text-success bg-success/10 border border-success/30 rounded-full px-2 py-0.5">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {meta.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Switch
                        checked={!!draft.enabled}
                        onCheckedChange={(v) => toggleEnabled(key, v)}
                      />
                      <button
                        onClick={() => setExpanded((prev) => ({ ...prev, [key]: !isOpen }))}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label={isOpen ? "Collapse" : "Expand"}
                      >
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded settings */}
                  {isOpen && (
                    <>
                      <div className="border-t border-border" />
                      <CardContent className="px-6 py-5">
                        <div className="grid sm:grid-cols-2 gap-5">
                          {/* Agent picker */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                              Agent
                            </label>
                            <Select
                              value={draft.agent_id || "__none__"}
                              onValueChange={(v) => setDraft(key, { agent_id: v === "__none__" ? null : v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select an agent" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">No agent selected</SelectItem>
                                {agents.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Delay */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                              {meta.delayLabel}
                            </label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={10080}
                                value={draft.delay_minutes ?? 30}
                                onChange={(e) => setDraft(key, { delay_minutes: Number(e.target.value) })}
                                className="w-28 font-mono"
                              />
                              <span className="text-sm text-muted-foreground">
                                min ({formatDelay(draft.delay_minutes ?? 30)})
                              </span>
                            </div>
                          </div>

                          {/* Max attempts */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                              Max attempts
                            </label>
                            <Select
                              value={String(draft.max_attempts ?? 3)}
                              onValueChange={(v) => setDraft(key, { max_attempts: Number(v) })}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <SelectItem key={n} value={String(n)}>
                                    {n}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Timezone */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                              Timezone
                            </label>
                            <Select
                              value={draft.timezone || "Asia/Kolkata"}
                              onValueChange={(v) => setDraft(key, { timezone: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TIMEZONES.map((tz) => (
                                  <SelectItem key={tz} value={tz}>
                                    {tz}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Quiet hours */}
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                              Call window (quiet hours)
                            </label>
                            <div className="flex items-center gap-3">
                              <Input
                                type="number"
                                min={0}
                                max={23}
                                value={draft.call_hours_start ?? 9}
                                onChange={(e) => setDraft(key, { call_hours_start: Number(e.target.value) })}
                                className="w-20 font-mono"
                              />
                              <span className="text-sm text-muted-foreground">to</span>
                              <Input
                                type="number"
                                min={0}
                                max={23}
                                value={draft.call_hours_end ?? 21}
                                onChange={(e) => setDraft(key, { call_hours_end: Number(e.target.value) })}
                                className="w-20 font-mono"
                              />
                              <span className="text-xs text-muted-foreground">
                                (24h format, {draft.timezone || "Asia/Kolkata"})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 flex justify-end">
                          <Button
                            size="sm"
                            disabled={saving[key]}
                            onClick={() => save(key)}
                          >
                            {saving[key] ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Save
                          </Button>
                        </div>
                      </CardContent>
                    </>
                  )}
                </Card>
              );
            })}
      </div>
    </div>
  );
}

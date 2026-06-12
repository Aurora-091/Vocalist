import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Pause,
  X,
  ShieldCheck,
  TriangleAlert as AlertTriangle,
  Users,
  Upload,
  Clock,
  Check,
} from "lucide-react";
import { getCampaign, listContacts } from "../lib/db";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { Button } from "../components/legacy-ui/Button";
import { Card, CardBody, CardHeader } from "../components/legacy-ui/Card";
import { Badge } from "../components/legacy-ui/Badge";
import { StatCard } from "../components/legacy-ui/StatCard";
import { Skeleton } from "../components/legacy-ui/States";

const STATUS_TONE: Record<string, "success" | "info" | "neutral" | "warning" | "danger"> = {
  draft: "neutral",
  scheduled: "info",
  running: "success",
  paused: "warning",
  completed: "neutral",
  canceled: "danger",
};

type ComplianceReview = {
  total_targets: number;
  consented: number;
  excluded_dnc: number;
  excluded_no_consent: number;
  estimated_cost_usd: number;
  spend_check_passed: boolean;
  ready_to_launch: boolean;
  block_reason: string | null;
};

type Contact = {
  id: string;
  e164: string;
  name: string | null;
  consent_status: string;
};

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<any>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [acting, setActing] = useState(false);
  const [review, setReview] = useState<ComplianceReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  async function load() {
    try {
      const c = await getCampaign(id!);
      setCampaign(c);

      const { data: targets } = await supabase
        .from("campaign_targets")
        .select("state")
        .eq("campaign_id", id!);
      const grouped: Record<string, number> = {};
      for (const t of targets || []) {
        grouped[t.state] = (grouped[t.state] || 0) + 1;
      }
      setStats(grouped);
    } catch {}
  }

  async function loadReview() {
    setReviewLoading(true);
    try {
      const res = await api.get<ComplianceReview>(`/v1/campaigns/${id}/review`);
      setReview(res);
    } catch {
      setReview(null);
    } finally {
      setReviewLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadReview();
  }, [id]);

  useEffect(() => {
    if (!id || !campaign) return;
    const status = campaign.status as string;
    if (status !== "running") return;

    const channel = supabase
      .channel(`campaign_targets_${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaign_targets",
          filter: `campaign_id=eq.${id}`,
        },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, campaign?.status]);

  async function setStatus(status: string) {
    if (status === "running" && review && !review.ready_to_launch) return;
    setActing(true);
    try {
      await supabase
        .from("campaigns")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id!);
      await load();
    } finally {
      setActing(false);
    }
  }

  if (!campaign) return <Skeleton className="h-64" />;

  const status = campaign.status as string;
  const canStart = status === "draft" || status === "paused" || status === "scheduled";
  const canPause = status === "running";
  const canCancel = !["completed", "canceled"].includes(status);
  const total = Object.values(stats).reduce((s: number, v) => s + (v as number), 0);
  const startBlocked = canStart && review && !review.ready_to_launch;
  const isDraft = status === "draft";

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/campaigns"
          className="inline-flex items-center text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to campaigns
        </Link>
        <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
              <Badge tone={STATUS_TONE[status] || "neutral"} dot>
                {status}
              </Badge>
            </div>
            <p className="text-sm text-text-muted mt-1">
              Concurrency {campaign.concurrency} · Max retries {campaign.max_retries}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isDraft && (
              <>
                <Button variant="secondary" onClick={() => setShowAddContacts(true)}>
                  <Users className="w-4 h-4 mr-2" />
                  Add contacts
                </Button>
                <Button variant="secondary" onClick={() => setShowSchedule(true)}>
                  <Clock className="w-4 h-4 mr-2" />
                  Schedule
                </Button>
              </>
            )}
            {canStart && (
              <Button
                onClick={() => setStatus("running")}
                disabled={acting || !!startBlocked}
                title={startBlocked ? `Blocked: ${review?.block_reason}` : undefined}
              >
                <Play className="w-4 h-4 mr-2" />
                Start
              </Button>
            )}
            {canPause && (
              <Button
                variant="secondary"
                onClick={() => setStatus("paused")}
                disabled={acting}
              >
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}
            {canCancel && (
              <Button
                variant="ghost"
                onClick={() => setStatus("canceled")}
                disabled={acting}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {showAddContacts && (
        <AddContactsPanel
          campaignId={id!}
          onClose={() => setShowAddContacts(false)}
          onDone={() => { setShowAddContacts(false); load(); loadReview(); }}
        />
      )}

      {showSchedule && (
        <SchedulePanel
          campaign={campaign}
          onClose={() => setShowSchedule(false)}
          onSaved={() => { setShowSchedule(false); load(); }}
        />
      )}

      {canStart && review && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 font-medium">
              {review.ready_to_launch ? (
                <ShieldCheck className="w-4 h-4 text-success" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-warning" />
              )}
              Pre-launch compliance review
            </div>
          </CardHeader>
          <CardBody>
            {reviewLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-text-muted text-xs mb-1">Eligible (consented)</div>
                  <div className="font-mono text-lg font-semibold text-success">{review.consented}</div>
                </div>
                <div>
                  <div className="text-text-muted text-xs mb-1">Excluded (DNC/revoked)</div>
                  <div className="font-mono text-lg font-semibold text-danger">{review.excluded_dnc}</div>
                </div>
                <div>
                  <div className="text-text-muted text-xs mb-1">No consent yet</div>
                  <div className="font-mono text-lg font-semibold text-warning">{review.excluded_no_consent}</div>
                </div>
                <div>
                  <div className="text-text-muted text-xs mb-1">Estimated cost</div>
                  <div className="font-mono text-lg font-semibold">${review.estimated_cost_usd.toFixed(2)}</div>
                </div>
              </div>
            )}
            {review.block_reason && (
              <div className="mt-4 p-3 rounded-md bg-warning/10 border border-warning/20 text-sm text-warning">
                {review.block_reason === "no_consented_targets" &&
                  "No targets have granted consent. Add consented contacts before launching."}
                {review.block_reason === "spend_limit_exceeded" &&
                  "Estimated cost exceeds your spend guard limit. Adjust limits in Settings or reduce targets."}
                {review.block_reason === "no_targets" && (
                  <span>
                    No queued targets.{" "}
                    <button
                      className="underline"
                      onClick={() => setShowAddContacts(true)}
                    >
                      Add contacts to this campaign
                    </button>{" "}
                    first.
                  </span>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total targets" value={total} />
        <StatCard label="Queued" value={stats.queued ?? 0} />
        <StatCard label="In progress" value={stats.in_progress ?? 0} />
        <StatCard label="Completed" value={stats.completed ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="font-medium">Target breakdown</div>
            {status === "running" && (
              <Badge tone="success" dot>Live updates</Badge>
            )}
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(stats).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <span className="text-sm text-text-muted capitalize">{k.replace(/_/g, " ")}</span>
                <span className="font-mono text-sm">{v as number}</span>
              </div>
            ))}
            {Object.keys(stats).length === 0 && (
              <div className="text-sm text-text-muted sm:col-span-2">
                No targets yet.{" "}
                {isDraft && (
                  <button className="underline text-text" onClick={() => setShowAddContacts(true)}>
                    Add contacts from your list
                  </button>
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function AddContactsPanel({
  campaignId,
  onClose,
  onDone,
}: {
  campaignId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "granted">("granted");
  const [q, setQ] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(query?: string) {
    try {
      const raw = await listContacts({ q: query, limit: 200 });
      const filtered =
        filter === "granted" ? raw.filter((c: any) => c.consent_status === "granted") : raw;
      setContacts(filtered as Contact[]);
    } catch {
      setContacts([]);
    }
  }

  useEffect(() => { load(); }, [filter]);

  function handleQ(val: string) {
    setQ(val);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(val), 300);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!contacts) return;
    setSelected(new Set(contacts.map((c) => c.id)));
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<{ added: number }>(`/v1/campaigns/${campaignId}/targets`, {
        contact_ids: Array.from(selected),
      });
      setResult(`Added ${res.added} target${res.added !== 1 ? "s" : ""} to campaign.`);
      setTimeout(onDone, 800);
    } catch (e: any) {
      setResult(e.message || "Failed to add contacts.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            Add contacts to campaign
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardBody>
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 p-1 bg-surface-2 rounded-md border border-border">
              <button
                type="button"
                onClick={() => { setFilter("granted"); setSelected(new Set()); }}
                className={`px-3 py-1 text-xs rounded transition-colors ${filter === "granted" ? "bg-surface text-text font-medium border border-border" : "text-text-muted hover:text-text"}`}
              >
                Consented only
              </button>
              <button
                type="button"
                onClick={() => { setFilter("all"); setSelected(new Set()); }}
                className={`px-3 py-1 text-xs rounded transition-colors ${filter === "all" ? "bg-surface text-text font-medium border border-border" : "text-text-muted hover:text-text"}`}
              >
                All contacts
              </button>
            </div>
            <input
              value={q}
              onChange={(e) => handleQ(e.target.value)}
              placeholder="Search…"
              className="h-8 px-3 rounded-md border border-border bg-surface text-sm flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-text-muted hover:text-text px-2 py-1 rounded border border-border hover:bg-surface-2 transition-colors"
            >
              Select all
            </button>
          </div>

          {contacts === null ? (
            <Skeleton className="h-40" />
          ) : contacts.length === 0 ? (
            <div className="text-sm text-text-muted py-6 text-center">
              {filter === "granted"
                ? "No contacts with granted consent. Switch to 'All contacts' or add consent to your contacts."
                : "No contacts found."}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-border rounded-md divide-y divide-border">
              {contacts.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="rounded border-border"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {c.name || <span className="text-text-muted font-normal">No name</span>}
                    </div>
                    <div className="text-xs font-mono text-text-muted">{c.e164}</div>
                  </div>
                  {c.consent_status === "granted" && (
                    <Check className="w-3.5 h-3.5 text-success shrink-0" />
                  )}
                </label>
              ))}
            </div>
          )}

          {result && <div className="text-sm text-text-muted">{result}</div>}

          <div className="flex justify-between items-center">
            <span className="text-xs text-text-muted">
              {selected.size} contact{selected.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
              <Button
                onClick={addSelected}
                disabled={busy || selected.size === 0}
              >
                <Upload className="w-4 h-4 mr-2" />
                {busy ? "Adding…" : `Add ${selected.size > 0 ? selected.size : ""} to campaign`}
              </Button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

const TZ_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function SchedulePanel({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tz, setTz] = useState(campaign.calling_tz || "America/New_York");
  const [windowStart, setWindowStart] = useState(
    campaign.window_start ? campaign.window_start.slice(0, 16) : ""
  );
  const [windowEnd, setWindowEnd] = useState(
    campaign.window_end ? campaign.window_end.slice(0, 16) : ""
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await supabase
        .from("campaigns")
        .update({
          calling_tz: tz,
          window_start: windowStart ? new Date(windowStart).toISOString() : null,
          window_end: windowEnd ? new Date(windowEnd).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
      onSaved();
    } catch (e: any) {
      setErr(e.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Dialing schedule
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardBody>
        <form onSubmit={save} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Timezone</label>
              <select
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm"
              >
                {TZ_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Start (optional)</label>
              <input
                type="datetime-local"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">End (optional)</label>
              <input
                type="datetime-local"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-text-muted">
            Calls are only placed between 9 AM – 7 PM in the selected timezone regardless of window settings.
          </p>
          {err && <div className="text-sm text-danger">{err}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save schedule"}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

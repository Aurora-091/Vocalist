import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Pause, X, ShieldCheck, TriangleAlert as AlertTriangle } from "lucide-react";
import { getCampaign } from "../lib/db";
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

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<any>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [acting, setActing] = useState(false);
  const [review, setReview] = useState<ComplianceReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

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
      const res = await api.get(`/v1/campaigns/${id}/review`);
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
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
              <Badge tone={STATUS_TONE[status] || "neutral"} dot>
                {status}
              </Badge>
            </div>
            <p className="text-sm text-text-muted mt-1">
              Concurrency {campaign.concurrency} · Max retries {campaign.max_retries}
            </p>
          </div>
          <div className="flex gap-2">
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
                {review.block_reason === "no_targets" &&
                  "No queued targets. Add contacts to this campaign first."}
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
                No targets yet. Add contacts from the contacts page, then assign them to this campaign.
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

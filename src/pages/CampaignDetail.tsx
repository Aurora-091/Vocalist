import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Pause, X } from "lucide-react";
import { api } from "../lib/api";
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

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [acting, setActing] = useState(false);

  async function load() {
    const [c, s] = await Promise.all([
      api<any>(`/v1/campaigns/${id}`),
      api<any>(`/v1/campaigns/${id}/stats`).catch(() => null),
    ]);
    setCampaign(c.campaign);
    setStats(s);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id]);

  async function setStatus(status: string) {
    setActing(true);
    try {
      await api(`/v1/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
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

  const byState = stats?.by_state || {};
  const total = stats?.total || 0;

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
              <Button onClick={() => setStatus("running")} disabled={acting}>
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={total} />
        <StatCard label="Queued" value={byState.queued ?? 0} />
        <StatCard label="In progress" value={byState.in_progress ?? 0} />
        <StatCard label="Completed" value={byState.completed ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <div className="font-medium">Target breakdown</div>
        </CardHeader>
        <CardBody>
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(byState).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <span className="text-sm text-text-muted">{k}</span>
                <span className="font-mono text-sm">{v as number}</span>
              </div>
            ))}
            {Object.keys(byState).length === 0 && (
              <div className="text-sm text-text-muted">
                No targets yet. Add contacts from the contacts page or import a CSV.
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

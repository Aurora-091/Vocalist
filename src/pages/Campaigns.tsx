import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Megaphone, ChevronRight } from "lucide-react";
import { listCampaigns } from "../lib/db";
import { Button } from "../components/legacy-ui/Button";
import { EmptyState, Skeleton } from "../components/legacy-ui/States";
import { Badge } from "../components/legacy-ui/Badge";

type Campaign = {
  id: string;
  name: string;
  status: string;
  agent_id: string;
  created_at: string;
  concurrency: number;
  max_retries: number;
};

const STATUS_TONE: Record<string, "success" | "info" | "neutral" | "warning" | "danger"> = {
  draft: "neutral",
  scheduled: "info",
  running: "success",
  paused: "warning",
  completed: "neutral",
  canceled: "danger",
};

const FILTERS = ["all", "running", "paused", "draft", "completed"] as const;
type Filter = (typeof FILTERS)[number];

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    (async () => {
      try {
        setCampaigns(await listCampaigns());
      } catch {
        setCampaigns([]);
      }
    })();
  }, []);

  const visible =
    campaigns === null
      ? null
      : filter === "all"
      ? campaigns
      : campaigns.filter((c) => c.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-text-muted mt-1">
            Outbound runs against a list. Live monitor + retries built in.
          </p>
        </div>
        <Link to="/campaigns/new" className="shrink-0">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">New campaign</span>
            <span className="sm:hidden">New</span>
          </Button>
        </Link>
      </div>

      {/* Status filter chips */}
      {campaigns && campaigns.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 h-8 rounded-full text-xs font-medium transition-colors capitalize ${
                filter === f
                  ? "bg-primary text-white"
                  : "bg-surface border border-border text-text-muted hover:text-text"
              }`}
            >
              {f}
              {f !== "all" && campaigns && (
                <span className="ml-1.5 opacity-60">
                  {campaigns.filter((c) => c.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {visible === null ? (
        <Skeleton className="h-32" />
      ) : visible.length === 0 && campaigns?.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          description="Run your first outbound campaign once you've created an agent and uploaded contacts."
          cta={
            <Link to="/campaigns/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New campaign
              </Button>
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <div className="text-sm text-text-muted text-center py-12">
          No {filter} campaigns.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface border border-border rounded-md shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-text-muted">
                <tr>
                  <Th>Name</Th>
                  <Th>Status</Th>
                  <Th>Concurrency</Th>
                  <Th>Retries</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-border hover:bg-surface-2 cursor-pointer"
                  >
                    <Td>
                      <Link to={`/campaigns/${c.id}`} className="flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-text-muted shrink-0" />
                        <span className="font-medium">{c.name}</span>
                      </Link>
                    </Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                    <Td className="font-mono">{c.concurrency}</Td>
                    <Td className="font-mono">{c.max_retries}</Td>
                    <Td className="text-text-muted">
                      {new Date(c.created_at).toLocaleDateString()}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {visible.map((c) => (
              <Link
                key={c.id}
                to={`/campaigns/${c.id}`}
                className="flex items-center justify-between bg-surface border border-border rounded-md shadow-card p-4 active:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Megaphone className="w-4 h-4 text-text-muted shrink-0" />
                    <span className="font-medium truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <StatusBadge status={c.status} />
                    <span>{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {status === "running" && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
      )}
      <Badge tone={STATUS_TONE[status] || "neutral"} dot={status !== "running"}>
        {status}
      </Badge>
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 text-xs uppercase tracking-widest font-medium">
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

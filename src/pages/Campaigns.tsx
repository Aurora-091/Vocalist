import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Megaphone } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { EmptyState, Skeleton } from "../components/ui/States";
import { Badge } from "../components/ui/Badge";

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

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ campaigns: Campaign[] }>("/v1/campaigns");
        setCampaigns(r.campaigns || []);
      } catch {
        setCampaigns([]);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-text-muted mt-1">
            Outbound runs against a list. Live monitor + retries built in.
          </p>
        </div>
        <Link to="/campaigns/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New campaign
          </Button>
        </Link>
      </div>

      {campaigns === null ? (
        <Skeleton className="h-32" />
      ) : campaigns.length === 0 ? (
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
      ) : (
        <div className="bg-surface border border-border rounded-md shadow-card overflow-hidden">
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
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-border hover:bg-surface-2 cursor-pointer"
                >
                  <Td>
                    <Link to={`/campaigns/${c.id}`} className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-text-muted" />
                      <span className="font-medium">{c.name}</span>
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[c.status] || "neutral"} dot>
                      {c.status}
                    </Badge>
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
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 text-xs uppercase tracking-widest font-medium">
      {children}
    </th>
  );
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Megaphone, ChevronRight } from "lucide-react";
import { listCampaigns } from "../lib/db";
import { toast } from "sonner";
import { useVertical } from "../lib/VerticalContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";

type Campaign = {
  id: string;
  name: string;
  status: string;
  agent_id: string;
  created_at: string;
  concurrency: number;
  max_retries: number;
};

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-muted text-foreground",
  scheduled: "bg-info/15 text-info",
  running: "bg-success/15 text-success",
  paused: "bg-warning/15 text-warning",
  completed: "bg-muted text-foreground",
  canceled: "bg-danger/15 text-danger",
};

const FILTERS = ["all", "running", "paused", "draft", "completed"] as const;
type Filter = (typeof FILTERS)[number];

export default function Campaigns() {
  usePageTitle("Campaigns");
  const { t } = useVertical();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    (async () => {
      try {
        setCampaigns(await listCampaigns());
      } catch {
        toast.error("Failed to load campaigns");
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
          <h1 className="text-2xl font-semibold tracking-tight">{t("campaigns")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
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
        <div role="group" aria-label="Filter campaigns by status" className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`px-3 h-8 rounded-full text-xs font-medium transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
              {f !== "all" && campaigns && (
                <span className="ml-1.5 opacity-60" aria-label={`(${campaigns.filter((c) => c.status === f).length})`}>
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
        <Empty className="bg-card border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Megaphone /></EmptyMedia>
            <EmptyTitle>No campaigns yet</EmptyTitle>
            <EmptyDescription>Run your first outbound campaign once you've created an agent and uploaded contacts.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link to="/campaigns/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New campaign
              </Button>
            </Link>
          </EmptyContent>
        </Empty>
      ) : visible.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-12">
          No {filter} campaigns.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card border border-border rounded-md shadow-card overflow-hidden">
            <Table aria-label="Campaigns list">
              <TableCaption srOnly>
                {visible.length} campaign{visible.length !== 1 ? "s" : ""}
                {filter !== "all" ? ` with status ${filter}` : ""}
              </TableCaption>
              <TableHeader className="bg-muted">
                <TableRow>
                  <Th>Name</Th>
                  <Th>Status</Th>
                  <Th>Concurrency</Th>
                  <Th>Retries</Th>
                  <Th>Created</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer focus-within:bg-muted/50"
                  >
                    <Td>
                      <Link
                        to={`/campaigns/${c.id}`}
                        className="flex items-center gap-2 focus-visible:outline-none focus-visible:underline"
                        aria-label={`Open campaign: ${c.name}`}
                      >
                        <Megaphone className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                        <span className="font-medium">{c.name}</span>
                      </Link>
                    </Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                    <Td className="font-mono">
                      <span aria-label={`Concurrency: ${c.concurrency}`}>{c.concurrency}</span>
                    </Td>
                    <Td className="font-mono">
                      <span aria-label={`Max retries: ${c.max_retries}`}>{c.max_retries}</span>
                    </Td>
                    <Td className="text-muted-foreground">
                      <time dateTime={c.created_at}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </time>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="md:hidden space-y-3" aria-label="Campaigns list">
            {visible.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/campaigns/${c.id}`}
                  className="flex items-center justify-between bg-card border border-border rounded-md shadow-card p-4 active:bg-muted hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border"
                  aria-label={`Campaign: ${c.name}, status: ${c.status}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Megaphone className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      <span className="font-medium truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <StatusBadge status={c.status} />
                      <time dateTime={c.created_at}>{new Date(c.created_at).toLocaleDateString()}</time>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 ml-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
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
      <Badge variant="secondary" className={STATUS_CLASS[status] || "bg-muted text-foreground"}>
        {status !== "running" && <span className="size-1.5 rounded-full bg-current mr-1 opacity-70" />}
        {status}
      </Badge>
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <TableHead scope="col" className="text-xs uppercase tracking-widest font-medium">
      {children}
    </TableHead>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <TableCell className={className}>{children}</TableCell>;
}

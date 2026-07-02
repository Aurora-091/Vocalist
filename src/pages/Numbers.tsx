import { useEffect, useState } from "react";
import { Phone, Plus, Trash2, Unlink, ShieldCheck, Loader as Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listPhoneNumbers, listAgents, unlinkPhoneNumberAgent, deletePhoneNumber } from "../lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SetupNumber } from "./SetupNumber";


type PhoneNumber = {
  id: string;
  e164: string;
  byo: boolean;
  owner: string;
  status: string | null;
  lifecycle_status: string | null;
  agent_id: string | null;
  telephony_provider: string | null;
  purchased_at: string | null;
  renews_at: string | null;
  monthly_cost: number | null;
  created_at: string;
};

type Agent = { id: string; name: string };

export default function Numbers() {
  const [numbers, setNumbers] = useState<PhoneNumber[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBuyOpen, setIsBuyOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [nums, ags] = await Promise.all([
        listPhoneNumbers(),
        listAgents(),
      ]);
      setNumbers(nums as PhoneNumber[]);
      setAgents(ags);
    } catch {
      setNumbers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function getAgentName(agentId: string | null): string {
    if (!agentId) return "—";
    const a = agents.find((ag) => ag.id === agentId);
    return a?.name || "Unknown";
  }

  async function unlinkAgent(numberId: string) {
    try {
      await unlinkPhoneNumberAgent(numberId);
      toast.success("Agent unlinked from number");
      load();
    } catch {
      toast.error("Failed to unlink agent");
    }
  }

  async function deleteNumber(numberId: string) {
    try {
      await deletePhoneNumber(numberId);
      toast.success("Number deleted");
      load();
    } catch {
      toast.error("Failed to delete number");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Phone Numbers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your phone numbers, assign agents, and track renewals.
          </p>
        </div>
        <Button size="sm" onClick={() => setIsBuyOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Buy Phone Number
        </Button>
      </div>

      {/* Table */}
      {loading || numbers === null ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : numbers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Phone className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No phone numbers yet.</p>
            <Button size="sm" onClick={() => setIsBuyOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Buy Phone Number
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-medium">Phone number</TableHead>
                  <TableHead className="text-xs font-medium">Status</TableHead>
                  <TableHead className="text-xs font-medium">Agent answering</TableHead>
                  <TableHead className="text-xs font-medium">Telephony</TableHead>
                  <TableHead className="text-xs font-medium">Purchased on</TableHead>
                  <TableHead className="text-xs font-medium">Renews on</TableHead>
                  <TableHead className="text-xs font-medium">Monthly rent</TableHead>
                  <TableHead className="text-xs font-medium">Unlink agent</TableHead>
                  <TableHead className="text-xs font-medium">Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {n.e164}
                      </div>
                    </TableCell>
                    <TableCell>
                      <NumberStatusBadge status={n.lifecycle_status || n.status || "unassigned"} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {n.agent_id ? (
                        <Badge variant="secondary" className="text-xs">
                          {getAgentName(n.agent_id)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {n.telephony_provider || "twilio"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {n.purchased_at
                        ? new Date(n.purchased_at).toLocaleDateString()
                        : n.created_at
                          ? new Date(n.created_at).toLocaleDateString()
                          : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {n.renews_at ? new Date(n.renews_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {n.monthly_cost != null ? `$${Number(n.monthly_cost).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      {n.agent_id ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => unlinkAgent(n.id)}
                        >
                          <Unlink className="h-3 w-3 mr-1" />
                          Unlink
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete phone number</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {n.e164}? This cannot be undone and the number will be released.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteNumber(n.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Compliance info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              All numbers include recording disclosure and comply with calling-window regulations.
              For US toll-free outbound, complete A2P verification in your telephony provider console.
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isBuyOpen} onOpenChange={setIsBuyOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buy / Link Phone Number</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <SetupNumber
              embedded={true}
              onComplete={() => {
                load();
                setIsBuyOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active:           { label: "Active",           variant: "default" },
  assigned:         { label: "Assigned",         variant: "default" },
  unassigned:       { label: "Unassigned",       variant: "secondary" },
  pending_purchase: { label: "Pending Purchase", variant: "outline" },
  pending_release:  { label: "Pending Release",  variant: "outline" },
  released:         { label: "Released",         variant: "secondary" },
  failed:           { label: "Failed",           variant: "destructive" },
};

function NumberStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, variant: "outline" as const };
  return (
    <Badge variant={cfg.variant} className="text-xs capitalize">
      {cfg.label}
    </Badge>
  );
}

import { useEffect, useState, useCallback } from "react";
import { Send, Eye, Mail, Megaphone, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  adminApi,
  type BroadcastEntry,
  type BroadcastPayload,
  type PaginatedResult,
} from "../../lib/admin-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

type Template = "waitlist_update" | "product_update" | "custom";
type RecipientType = "waitlist_pending" | "waitlist_approved" | "waitlist_all" | "users_all";

const TEMPLATE_OPTIONS: { value: Template; label: string; icon: typeof Mail }[] = [
  { value: "waitlist_update", label: "Waitlist Update", icon: Mail },
  { value: "product_update", label: "Product Update", icon: Megaphone },
  { value: "custom", label: "Custom", icon: FileText },
];

const RECIPIENT_OPTIONS: { value: RecipientType; label: string }[] = [
  { value: "waitlist_pending", label: "Waitlist (pending)" },
  { value: "waitlist_approved", label: "Waitlist (approved)" },
  { value: "waitlist_all", label: "All waitlist" },
  { value: "users_all", label: "All users" },
];

export default function AdminBroadcasts() {
  const [template, setTemplate] = useState<Template>("waitlist_update");
  const [recipientType, setRecipientType] = useState<RecipientType>("waitlist_pending");
  const [subject, setSubject] = useState("");
  const [heading, setHeading] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [featureName, setFeatureName] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [history, setHistory] = useState<PaginatedResult<BroadcastEntry> | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await adminApi.listBroadcasts({ page: historyPage, limit: 10 });
      setHistory(res);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  function buildPayload(previewOnly: boolean): BroadcastPayload {
    const variables: Record<string, string> = { heading, body_text: bodyText };
    if (template === "product_update") variables.feature_name = featureName;
    if (ctaText) variables.cta_text = ctaText;
    if (ctaUrl) variables.cta_url = ctaUrl;
    return { template, subject, variables, recipient_type: recipientType, preview_only: previewOnly };
  }

  async function handlePreview() {
    if (!subject || !heading || !bodyText) {
      toast.error("Fill in subject, heading, and body text");
      return;
    }
    setPreviewing(true);
    try {
      const res = await adminApi.sendBroadcast(buildPayload(true));
      setPreviewHtml(res.sample_html || null);
      setPreviewCount(res.count || res.recipient_count || 0);
    } catch (err: any) {
      toast.error(err.message || "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSend() {
    setConfirmOpen(false);
    setSending(true);
    try {
      const res = await adminApi.sendBroadcast(buildPayload(false));
      toast.success(`Broadcast sent to ${res.recipient_count} recipients`);
      setSubject("");
      setHeading("");
      setBodyText("");
      setFeatureName("");
      setCtaText("");
      setCtaUrl("");
      loadHistory();
    } catch (err: any) {
      toast.error(err.message || "Send failed");
    } finally {
      setSending(false);
    }
  }

  const historyPages = history ? Math.ceil(history.total / history.limit) : 1;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Broadcasts</h1>

      {/* Composer */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Compose Email</h2>
          <p className="text-sm text-muted-foreground">Select a template, fill in variables, and send to your audience.</p>
        </div>

        {/* Template picker */}
        <div className="flex gap-2">
          {TEMPLATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTemplate(opt.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                template === opt.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <opt.icon className="w-4 h-4" />
              {opt.label}
            </button>
          ))}
        </div>

        {/* Variable fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bc-subject">Subject line</Label>
            <Input id="bc-subject" placeholder="e.g. Exciting news from Weeber" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc-heading">Heading</Label>
            <Input id="bc-heading" placeholder="e.g. Your spot is almost ready" value={heading} onChange={(e) => setHeading(e.target.value)} />
          </div>
          {template === "product_update" && (
            <div className="space-y-1.5">
              <Label htmlFor="bc-feature">Feature name</Label>
              <Input id="bc-feature" placeholder="e.g. Multi-language support" value={featureName} onChange={(e) => setFeatureName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="bc-body">Body text</Label>
            <Textarea id="bc-body" placeholder="Main email content..." rows={4} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc-cta-text">CTA text (optional)</Label>
            <Input id="bc-cta-text" placeholder="e.g. Check it out" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc-cta-url">CTA URL (optional)</Label>
            <Input id="bc-cta-url" placeholder="https://..." value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
          </div>
        </div>

        {/* Recipient + actions */}
        <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
          <div className="space-y-1.5 w-full md:w-64">
            <Label>Recipients</Label>
            <Select value={recipientType} onValueChange={(v) => setRecipientType(v as RecipientType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECIPIENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePreview} disabled={previewing}>
              <Eye className="w-4 h-4 mr-1.5" />
              {previewing ? "Loading..." : "Preview"}
            </Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={sending || !subject || !heading || !bodyText}>
              <Send className="w-4 h-4 mr-1.5" />
              {sending ? "Sending..." : "Send Broadcast"}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      <Dialog open={!!previewHtml} onOpenChange={(open) => { if (!open) setPreviewHtml(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview ({previewCount} recipients)</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto border border-border rounded-md bg-white">
            {previewHtml && (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[500px] border-0"
                sandbox="allow-same-origin"
                title="Email preview"
              />
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm send dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm broadcast</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will send the "{subject}" email to all <strong>{RECIPIENT_OPTIONS.find((r) => r.value === recipientType)?.label}</strong> recipients. This action cannot be undone.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSend} disabled={sending}>
              <Send className="w-4 h-4 mr-1.5" />
              {sending ? "Sending..." : "Confirm Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcast History */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Broadcast History</h2>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Template</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Recipients</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Sent by</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyLoading && !history && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Loading...</td></tr>
                )}
                {history?.data.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No broadcasts sent yet</td></tr>
                )}
                {history?.data.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs capitalize">{entry.template.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate">{entry.subject}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{entry.recipient_count}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600">{entry.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{entry.sent_by_email || "---"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(entry.sent_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {history && historyPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Showing {(historyPage - 1) * history.limit + 1}--{Math.min(historyPage * history.limit, history.total)} of {history.total}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={historyPage <= 1} onClick={() => setHistoryPage(historyPage - 1)}>Prev</Button>
                <Button size="sm" variant="outline" disabled={historyPage >= historyPages} onClick={() => setHistoryPage(historyPage + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

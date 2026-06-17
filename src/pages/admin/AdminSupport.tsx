import { useState } from "react";
import { Search, Phone, Bot, CreditCard, Mail } from "lucide-react";
import { adminApi, type AdminUserDetail } from "../../lib/admin-api";
import { api } from "../../lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function AdminSupport() {
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [noResult, setNoResult] = useState(false);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setNoResult(false);
    setUser(null);
    setShowEmailForm(false);
    try {
      const res = await adminApi.listUsers({ q: q.trim(), limit: 1 });
      if (res.data.length > 0) {
        const detail = await adminApi.getUserDetail(res.data[0].id);
        setUser(detail);
      } else {
        setNoResult(true);
      }
    } finally {
      setSearching(false);
    }
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSendingEmail(true);
    try {
      await api.post(`/v1/admin/users/${user.id}/send-email`, {
        subject: emailSubject,
        body: emailBody,
      });
      toast.success("Email sent successfully");
      setEmailSubject("");
      setEmailBody("");
      setShowEmailForm(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Support</h1>

      <form onSubmit={handleSearch} className="flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search user by name or email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={searching}>
          {searching ? "Searching..." : "Find"}
        </Button>
      </form>

      {noResult && (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          No user found matching "{q}"
        </div>
      )}

      {user && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">{user.display_name || user.email}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                Last active: {user.last_active ? new Date(user.last_active).toLocaleString() : "Never"}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">Org</span>
                <span className="font-medium">{user.orgs?.name || "---"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Plan</span>
                <span className="font-medium capitalize">{user.orgs?.plan_id || "---"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Role</span>
                <span className="font-medium capitalize">{user.role}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Signup</span>
                <span className="font-medium">{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Link to={`/admin/agents?org=${user.org_id}`} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
              <Bot className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">View Agents</span>
            </Link>
            <Link to={`/admin/billing?org=${user.org_id}`} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">View Billing</span>
            </Link>
            <Link to={`/admin/logs?org=${user.org_id}`} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">View Logs</span>
            </Link>
            <button
              onClick={() => setShowEmailForm(!showEmailForm)}
              className={`bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left w-full ${showEmailForm ? "bg-muted/30" : ""}`}
            >
              <Mail className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Send Email</span>
            </button>
          </div>

          {showEmailForm && (
            <form onSubmit={handleSendEmail} className="bg-card border border-border rounded-lg p-5 space-y-4 max-w-xl">
              <h3 className="text-sm font-semibold">Send Email to {user.display_name || user.email}</h3>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Email subject..."
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Body</label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Email body..."
                  rows={4}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={sendingEmail}>
                  {sendingEmail ? "Sending..." : "Send Email"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowEmailForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          <div className="bg-muted/50 border border-dashed border-border rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">Ticket system coming soon</p>
          </div>
        </div>
      )}

      {!user && !noResult && (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground text-sm">Search for a user to view their activity and troubleshoot issues.</p>
        </div>
      )}
    </div>
  );
}

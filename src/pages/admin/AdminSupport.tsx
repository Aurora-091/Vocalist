import { useState } from "react";
import { Search, Phone, Bot, CreditCard } from "lucide-react";
import { adminApi, type AdminUserDetail } from "../../lib/admin-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function AdminSupport() {
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [noResult, setNoResult] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setNoResult(false);
    setUser(null);
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
        <div className="space-y-4">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/admin/agents" className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
              <Bot className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">View Agents</span>
            </Link>
            <Link to="/admin/billing" className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">View Billing</span>
            </Link>
            <Link to="/admin/logs" className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">View Logs</span>
            </Link>
          </div>

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

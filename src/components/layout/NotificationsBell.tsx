import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getOrgId } from "../../lib/db";

type Notification = {
  id: string;
  kind: string;
  payload: any;
  read_at: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  usage_alert: "Usage alert",
  call_failed: "Call failed",
  campaign_completed: "Campaign completed",
  consent_revoked: "Consent revoked",
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      const orgId = await getOrgId();
      if (!orgId) { setItems([]); return; }
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20);
      setItems(data || []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = (items || []).filter((n) => !n.read_at).length;

  async function markAll() {
    const orgId = await getOrgId();
    if (!orgId) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .is("read_at", null);
    load();
  }

  async function markOne(id: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-medium inline-flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-md shadow-card overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">Notifications</div>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs text-primary hover:text-primary-700"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">Loading...</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                You're all caught up.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markOne(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-muted ${
                    !n.read_at ? "bg-primary/[0.03]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      {KIND_LABEL[n.kind] || n.kind}
                    </div>
                    {!n.read_at && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  {n.payload?.message && (
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {n.payload.message}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

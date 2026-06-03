import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "../../lib/api";

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
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      const r = await api<{ notifications: Notification[] }>(
        "/v1/notifications?limit=20"
      );
      setItems(r.notifications || []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
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
    setBusy(true);
    try {
      await api("/v1/notifications/read-all", { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function markOne(id: string) {
    await api(`/v1/notifications/${id}/read`, { method: "POST" });
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2"
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
        <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-md shadow-card overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">Notifications</div>
            {unread > 0 && (
              <button
                onClick={markAll}
                disabled={busy}
                className="text-xs text-primary hover:text-primary-700 disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null ? (
              <div className="px-4 py-6 text-sm text-text-muted">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-6 text-sm text-text-muted text-center">
                You're all caught up.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markOne(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2 ${
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
                    <div className="mt-1 text-xs text-text-muted line-clamp-2">
                      {n.payload.message}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-text-muted">
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

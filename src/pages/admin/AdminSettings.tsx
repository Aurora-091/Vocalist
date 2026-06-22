import { useEffect, useState, useCallback } from "react";
import { adminApi, type PlatformSettings } from "../../lib/admin-api";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Loader as Loader2, CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";

const TOGGLE_SETTINGS = [
  { key: "maintenance_mode", label: "Maintenance Mode", description: "Show maintenance page to all users" },
  { key: "signup_enabled", label: "Signup Enabled", description: "Allow new user signups" },
  { key: "waitlist_enabled", label: "Waitlist Enabled", description: "Waitlist gate is active" },
  { key: "beta_features", label: "Beta Features", description: "Enable beta feature flags globally" },
  { key: "experimental_features", label: "Experimental Features", description: "Enable experimental/unstable features" },
];

type TagStatus = {
  status: "pending" | "loaded" | "disabled" | "error";
  tagId: string | null;
  tagType: "ga4" | "gtm" | null;
  posthog: boolean;
  loadedAt: string | null;
  error: string | null;
};

function TagValidationStatus() {
  const [tagStatus, setTagStatus] = useState<TagStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(() => {
    setChecking(true);
    setTimeout(() => {
      const status = window.__weeber_analytics || null;
      setTagStatus(status);
      setChecking(false);
    }, 500);
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkStatus, 1500);
    return () => clearTimeout(timer);
  }, [checkStatus]);

  if (!tagStatus && !checking) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Tag status not available yet
        </div>
        <Button variant="ghost" size="sm" onClick={checkStatus}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Check
        </Button>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verifying tag installation...
      </div>
    );
  }

  const statusConfig = {
    loaded: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", label: "Active" },
    disabled: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20", label: "Disabled" },
    error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20", label: "Error" },
    pending: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20", label: "Loading" },
  };

  const config = statusConfig[tagStatus!.status];
  const Icon = config.icon;

  return (
    <div className={`rounded-md border p-4 space-y-3 ${config.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color} ${tagStatus!.status === "pending" ? "animate-spin" : ""}`} />
          <span className="text-sm font-medium">Tag Status: {config.label}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={checkStatus} className="h-7 px-2">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tag ID</span>
          <span className="font-mono font-medium">{tagStatus!.tagId || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Type</span>
          <span className="font-medium uppercase">{tagStatus!.tagType || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">PostHog</span>
          <span className={`font-medium ${tagStatus!.posthog ? "text-emerald-600" : "text-muted-foreground"}`}>
            {tagStatus!.posthog ? "Connected" : "Not configured"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Loaded at</span>
          <span className="font-mono font-medium">
            {tagStatus!.loadedAt
              ? new Date(tagStatus!.loadedAt).toLocaleTimeString()
              : "—"}
          </span>
        </div>
      </div>

      {tagStatus!.error && (
        <div className="text-xs text-red-600 bg-red-500/5 rounded px-2 py-1.5 border border-red-500/10">
          {tagStatus!.error}
        </div>
      )}
    </div>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // GTM Tracking States
  const [gtmContainerId, setGtmContainerId] = useState("");
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [trackingLoading, setTrackingLoading] = useState(true);
  const [trackingSaving, setTrackingSaving] = useState(false);

  useEffect(() => {
    adminApi.getSettings()
      .then(setSettings)
      .finally(() => setLoading(false));

    loadTrackingSettings();
  }, []);

  async function loadTrackingSettings() {
    try {
      setTrackingLoading(true);
      const { data, error } = await supabase
        .from("site_settings")
        .select("gtm_container_id, tracking_enabled")
        .eq("id", true)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setGtmContainerId(data.gtm_container_id || "");
        setTrackingEnabled(data.tracking_enabled);
      }
    } catch (err) {
      console.error("Failed to load tracking settings:", err);
      toast.error("Failed to load tracking settings");
    } finally {
      setTrackingLoading(false);
    }
  }

  async function toggleSetting(key: string) {
    if (!settings) return;
    const current = settings[key]?.value;
    const next = !current;
    setSaving(key);
    try {
      await adminApi.updateSetting(key, next);
      setSettings((prev) => prev ? { ...prev, [key]: { value: next, updated_at: new Date().toISOString() } } : prev);
      toast.success(`${key.replace(/_/g, " ")} updated`);
    } catch {
      toast.error("Failed to update setting");
    } finally {
      setSaving(null);
    }
  }

  async function handleToggleTracking(checked: boolean) {
    setTrackingEnabled(checked);
    setTrackingSaving(true);
    try {
      const { error } = await supabase
        .from("site_settings")
        .update({
          tracking_enabled: checked,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true);

      if (error) throw error;
      toast.success(`Tracking ${checked ? "enabled" : "disabled"} site-wide`);
    } catch (err) {
      console.error("Failed to update tracking status:", err);
      toast.error("Failed to update tracking status");
      // Revert state
      setTrackingEnabled(!checked);
    } finally {
      setTrackingSaving(false);
    }
  }

  async function handleSaveGtmId() {
    setTrackingSaving(true);
    try {
      const { error } = await supabase
        .from("site_settings")
        .update({
          gtm_container_id: gtmContainerId.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true);

      if (error) throw error;
      toast.success("GTM Container ID updated successfully");
    } catch (err) {
      console.error("Failed to update GTM ID:", err);
      toast.error("Failed to update GTM ID");
    } finally {
      setTrackingSaving(false);
    }
  }

  if (loading || trackingLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          Loading Settings...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Platform Controls */}
      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold">Platform Controls</h2>
          <p className="text-xs text-muted-foreground mt-1">Toggle platform-wide feature flags and controls</p>
        </div>
        {TOGGLE_SETTINGS.map((s) => {
          const current = settings?.[s.key]?.value;
          const isOn = Boolean(current);
          return (
            <div key={s.key} className="px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
              </div>
              <Switch
                checked={isOn}
                onCheckedChange={() => toggleSetting(s.key)}
                disabled={saving === s.key}
              />
            </div>
          );
        })}
      </div>

      {/* Tracking Card */}
      <Card>
        <CardHeader>
          <CardTitle>Tracking & Analytics</CardTitle>
          <CardDescription>
            Manage Google Tag Manager integration for the entire platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <div className="text-sm font-medium">Enable tracking site-wide</div>
              <div className="text-xs text-muted-foreground mt-0.5">Toggle script loading for GTM</div>
            </div>
            <Switch
              checked={trackingEnabled}
              onCheckedChange={handleToggleTracking}
              disabled={trackingSaving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4 items-end">
            <div className="grid gap-2 sm:col-span-3">
              <Label htmlFor="gtm-container-id">GTM Container ID</Label>
              <Input
                id="gtm-container-id"
                placeholder="GTM-XXXXXXX"
                value={gtmContainerId}
                onChange={(e) => setGtmContainerId(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSaveGtmId}
              disabled={trackingSaving}
            >
              {trackingSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save ID"
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed pt-2">
            Manage all GA4, Google Ads, and Meta tags inside the Google Tag Manager dashboard.
            Changing this ID takes effect on the next page load — no redeploy.
          </p>

          <div className="pt-2">
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">Installation Validation</Label>
            <TagValidationStatus />
            <p className="text-[10px] text-muted-foreground mt-1.5 leading-normal">
              Note: Status may report <strong>Error</strong> or script failures if you have an active ad-blocker or tracking protection enabled in your browser.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

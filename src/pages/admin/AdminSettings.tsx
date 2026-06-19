import { useEffect, useState } from "react";
import { adminApi, type PlatformSettings } from "../../lib/admin-api";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";

const TOGGLE_SETTINGS = [
  { key: "maintenance_mode", label: "Maintenance Mode", description: "Show maintenance page to all users" },
  { key: "signup_enabled", label: "Signup Enabled", description: "Allow new user signups" },
  { key: "waitlist_enabled", label: "Waitlist Enabled", description: "Waitlist gate is active" },
  { key: "beta_features", label: "Beta Features", description: "Enable beta feature flags globally" },
  { key: "experimental_features", label: "Experimental Features", description: "Enable experimental/unstable features" },
];

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
        </CardContent>
      </Card>
    </div>
  );
}

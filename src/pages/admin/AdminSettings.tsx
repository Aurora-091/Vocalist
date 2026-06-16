import { useEffect, useState } from "react";
import { adminApi, type PlatformSettings } from "../../lib/admin-api";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

  useEffect(() => {
    adminApi.getSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

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
    </div>
  );
}

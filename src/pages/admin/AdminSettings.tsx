import { useEffect, useState } from "react";
import { adminApi, type PlatformSettings } from "../../lib/admin-api";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Edit, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getActiveTrackingProfile,
  getSiteSettings,
  listTrackingProfiles,
  createTrackingProfile,
  updateTrackingProfile,
  deleteTrackingProfile,
  activateTrackingProfile,
  updateSiteSettings,
  type TrackingProfile,
  type SiteSettings,
} from "../../lib/tracking";

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

  // Tracking & Analytics states
  const [profiles, setProfiles] = useState<TrackingProfile[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(true);
  const [trackingSaving, setTrackingSaving] = useState(false);

  // Dialog & Form states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TrackingProfile | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<TrackingProfile | null>(null);

  const [newProfile, setNewProfile] = useState({
    name: "",
    ga4_id: "",
    ads_conversion_id: "",
    ads_conversion_label: "",
  });

  const [metaPixelId, setMetaPixelId] = useState("");

  useEffect(() => {
    adminApi.getSettings()
      .then(setSettings)
      .finally(() => setLoading(false));

    loadTrackingData();
  }, []);

  async function loadTrackingData() {
    try {
      setTrackingLoading(true);
      const [profilesData, siteSettingsData] = await Promise.all([
        listTrackingProfiles(),
        getSiteSettings()
      ]);
      setProfiles(profilesData);
      setSiteSettings(siteSettingsData);
      setMetaPixelId(siteSettingsData.meta_pixel_id || "");
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

  // Tracking Action Handlers
  async function handleToggleTracking(checked: boolean) {
    if (!siteSettings) return;
    setTrackingSaving(true);
    try {
      const updated = await updateSiteSettings({ tracking_enabled: checked });
      setSiteSettings(updated);
      toast.success(`Global tracking ${checked ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error("Failed to update tracking toggle");
    } finally {
      setTrackingSaving(false);
    }
  }

  async function handleSaveMetaPixel() {
    setTrackingSaving(true);
    try {
      const updated = await updateSiteSettings({ meta_pixel_id: metaPixelId.trim() || null });
      setSiteSettings(updated);
      toast.success("Meta Pixel ID updated successfully!");
    } catch (err) {
      toast.error("Failed to update Meta Pixel ID");
    } finally {
      setTrackingSaving(false);
    }
  }

  async function handleActivateProfile(id: string) {
    try {
      await activateTrackingProfile(id);
      toast.success("Profile activated successfully!");
      // Reload page so next load immediately starts using it
      window.location.reload();
    } catch (err) {
      toast.error("Failed to activate profile");
    }
  }

  async function handleAddProfile() {
    if (!newProfile.name.trim() || !newProfile.ga4_id.trim() || !newProfile.ads_conversion_id.trim()) {
      toast.error("Name, GA4 ID, and Google Ads Conversion ID are required.");
      return;
    }
    setTrackingSaving(true);
    try {
      await createTrackingProfile({
        name: newProfile.name.trim(),
        ga4_id: newProfile.ga4_id.trim(),
        ads_conversion_id: newProfile.ads_conversion_id.trim(),
        ads_conversion_label: newProfile.ads_conversion_label.trim(),
      });
      toast.success("Tracking profile created successfully!");
      setIsAddDialogOpen(false);
      setNewProfile({ name: "", ga4_id: "", ads_conversion_id: "", ads_conversion_label: "" });
      await loadTrackingData();
    } catch (err) {
      toast.error("Failed to create tracking profile");
    } finally {
      setTrackingSaving(false);
    }
  }

  async function handleUpdateProfile() {
    if (!editingProfile) return;
    if (!editingProfile.name.trim() || !editingProfile.ga4_id.trim() || !editingProfile.ads_conversion_id.trim()) {
      toast.error("Name, GA4 ID, and Google Ads Conversion ID are required.");
      return;
    }
    setTrackingSaving(true);
    try {
      await updateTrackingProfile(editingProfile.id, {
        name: editingProfile.name.trim(),
        ga4_id: editingProfile.ga4_id.trim(),
        ads_conversion_id: editingProfile.ads_conversion_id.trim(),
        ads_conversion_label: editingProfile.ads_conversion_label.trim(),
      });
      toast.success("Tracking profile updated successfully!");
      setIsEditDialogOpen(false);
      setEditingProfile(null);
      await loadTrackingData();
    } catch (err) {
      toast.error("Failed to update tracking profile");
    } finally {
      setTrackingSaving(false);
    }
  }

  function handleDeleteClick(profile: TrackingProfile) {
    if (profile.is_active) {
      toast.warning("Cannot delete the active tracking profile. Switch to another profile first.");
      return;
    }
    setProfileToDelete(profile);
  }

  async function handleConfirmDelete() {
    if (!profileToDelete) return;
    try {
      await deleteTrackingProfile(profileToDelete.id);
      toast.success("Tracking profile deleted successfully!");
      setProfileToDelete(null);
      await loadTrackingData();
    } catch (err) {
      toast.error("Failed to delete tracking profile");
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
    <div className="space-y-8 pb-12">
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

      {/* Tracking & Analytics Header/Divider */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Tracking & Analytics</h2>
            <p className="text-sm text-muted-foreground">
              Manage GA4, Google Ads conversion labels, and Meta Pixels dynamically.
            </p>
          </div>
          {siteSettings && (
            <div className="flex items-center gap-3 bg-secondary/30 px-3 py-1.5 rounded-lg border">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Master Tracking
              </span>
              <Switch
                checked={siteSettings.tracking_enabled}
                onCheckedChange={handleToggleTracking}
                disabled={trackingSaving}
              />
            </div>
          )}
        </div>

        {/* Card A: Tracking Profiles (Google Analytics + Ads) */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-4">
            <div>
              <CardTitle>Google Tracking Profiles</CardTitle>
              <CardDescription>
                Rotate GA4 & Google Ads configurations. Exactly one profile is active at a time.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingProfile(null);
                setNewProfile({ name: "", ga4_id: "", ads_conversion_id: "", ads_conversion_label: "" });
                setIsAddDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Profile
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {profiles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium">No tracking profiles created yet</p>
                <p className="text-xs mt-1">Create a profile to start tracking GA4 or Ads events</p>
              </div>
            ) : (
              <Table aria-label="Google Analytics and Ads Tracking Profiles">
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile Name</TableHead>
                    <TableHead>GA4 ID</TableHead>
                    <TableHead>Google Ads ID</TableHead>
                    <TableHead>Conversion Label</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id} className={profile.is_active ? "bg-accent/40" : ""}>
                      <TableCell className="font-medium max-w-[150px] truncate">{profile.name}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate">{profile.ga4_id}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate">{profile.ads_conversion_id}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[120px] truncate">{profile.ads_conversion_label || "-"}</TableCell>
                      <TableCell className="text-center">
                        {profile.is_active ? (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!profile.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleActivateProfile(profile.id)}
                            >
                              Activate
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setEditingProfile({ ...profile });
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteClick(profile)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Card B: Meta Pixel Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Meta Pixel Integration</CardTitle>
              <CardDescription>
                Track Facebook PageView and conversion events globally on client-side loading.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="meta-pixel-id">Meta Pixel ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="meta-pixel-id"
                    placeholder="e.g. 123456789012345"
                    value={metaPixelId}
                    onChange={(e) => setMetaPixelId(e.target.value)}
                  />
                  <Button
                    onClick={handleSaveMetaPixel}
                    disabled={trackingSaving}
                  >
                    {trackingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips / Documentation Card */}
          <Card>
            <CardHeader>
              <CardTitle>Tracking Instructions</CardTitle>
              <CardDescription>
                Guidelines for setting up analytics profiles correctly.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                <strong>Google GA4:</strong> Ensure Measurement ID starts with <code>G-</code>.
              </p>
              <p>
                <strong>Google Ads:</strong> Ensure Conversion ID starts with <code>AW-</code>. The conversion label is typically a string generated by the conversion event setup in your Google Ads dashboard.
              </p>
              <p>
                <strong>Zero Redeployment:</strong> Activating a profile switches it instantly for all visitors. Site reload will occur after you click active to refresh the active trackers on your admin page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tracking Profile</DialogTitle>
            <DialogDescription>
              Create a new Google GA4 and Google Ads tracking profile set.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="add-name">Profile Name</Label>
              <Input
                id="add-name"
                placeholder="e.g. June Summer Campaign"
                value={newProfile.name}
                onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-ga4">GA4 Measurement ID</Label>
              <Input
                id="add-ga4"
                placeholder="e.g. G-XXXXXXX"
                value={newProfile.ga4_id}
                onChange={(e) => setNewProfile({ ...newProfile, ga4_id: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-ads-id">Google Ads Conversion ID</Label>
              <Input
                id="add-ads-id"
                placeholder="e.g. AW-XXXXXXX"
                value={newProfile.ads_conversion_id}
                onChange={(e) => setNewProfile({ ...newProfile, ads_conversion_id: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-ads-label">Google Ads Conversion Label</Label>
              <Input
                id="add-ads-label"
                placeholder="e.g. XXXXXXX-XXXXXX"
                value={newProfile.ads_conversion_label}
                onChange={(e) => setNewProfile({ ...newProfile, ads_conversion_label: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddProfile} disabled={trackingSaving}>
              {trackingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) setEditingProfile(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tracking Profile</DialogTitle>
            <DialogDescription>
              Update the settings for this tracking profile.
            </DialogDescription>
          </DialogHeader>
          {editingProfile && (
            <div className="space-y-4 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-name">Profile Name</Label>
                <Input
                  id="edit-name"
                  placeholder="e.g. June Summer Campaign"
                  value={editingProfile.name}
                  onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-ga4">GA4 Measurement ID</Label>
                <Input
                  id="edit-ga4"
                  placeholder="e.g. G-XXXXXXX"
                  value={editingProfile.ga4_id}
                  onChange={(e) => setEditingProfile({ ...editingProfile, ga4_id: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-ads-id">Google Ads Conversion ID</Label>
                <Input
                  id="edit-ads-id"
                  placeholder="e.g. AW-XXXXXXX"
                  value={editingProfile.ads_conversion_id}
                  onChange={(e) => setEditingProfile({ ...editingProfile, ads_conversion_id: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-ads-label">Google Ads Conversion Label</Label>
                <Input
                  id="edit-ads-label"
                  placeholder="e.g. XXXXXXX-XXXXXX"
                  value={editingProfile.ads_conversion_label}
                  onChange={(e) => setEditingProfile({ ...editingProfile, ads_conversion_label: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProfile} disabled={trackingSaving}>
              {trackingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!profileToDelete} onOpenChange={(open) => {
        if (!open) setProfileToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the tracking profile "{profileToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              Delete Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

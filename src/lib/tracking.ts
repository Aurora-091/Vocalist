import { supabase } from "./supabase";

export interface TrackingProfile {
  id: string;
  name: string;
  ga4_id: string;
  ads_conversion_id: string;
  ads_conversion_label: string;
  is_active: boolean;
  created_at: string;
}

export interface SiteSettings {
  id: boolean;
  meta_pixel_id: string | null;
  tracking_enabled: boolean;
}

export async function getActiveTrackingProfile(): Promise<TrackingProfile | null> {
  const { data, error } = await supabase
    .from("tracking_profiles")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw error;
  return data;
}

export async function listTrackingProfiles(): Promise<TrackingProfile[]> {
  const { data, error } = await supabase
    .from("tracking_profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createTrackingProfile(
  fields: Omit<TrackingProfile, "id" | "is_active" | "created_at">
): Promise<TrackingProfile> {
  const { data, error } = await supabase
    .from("tracking_profiles")
    .insert({
      name: fields.name,
      ga4_id: fields.ga4_id,
      ads_conversion_id: fields.ads_conversion_id,
      ads_conversion_label: fields.ads_conversion_label,
      is_active: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTrackingProfile(
  id: string,
  fields: Partial<Omit<TrackingProfile, "id" | "created_at">>
): Promise<TrackingProfile> {
  const { data, error } = await supabase
    .from("tracking_profiles")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTrackingProfile(id: string): Promise<void> {
  const { error } = await supabase
    .from("tracking_profiles")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function activateTrackingProfile(id: string): Promise<void> {
  const { error } = await supabase.rpc("activate_tracking_profile", {
    profile_id: id,
  });
  if (error) throw error;
}

export async function updateSiteSettings(
  fields: Partial<Omit<SiteSettings, "id">>
): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .update(fields)
    .eq("id", true)
    .select()
    .single();
  if (error) throw error;
  return data;
}

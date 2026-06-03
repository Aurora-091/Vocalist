import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Session = {
  user_id: string;
  org_id: string | null;
  email: string | null;
  role: string | null;
  token: string;
};

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const meta = (data.session.user.app_metadata || {}) as any;
  return {
    user_id: data.session.user.id,
    org_id: meta.org_id || null,
    email: data.session.user.email || null,
    role: meta.role || null,
    token: data.session.access_token,
  };
}

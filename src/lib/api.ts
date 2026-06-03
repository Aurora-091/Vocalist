import { supabase } from "./supabase";

export async function api<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let detail: any;
    try {
      detail = JSON.parse(text);
    } catch {
      detail = text;
    }
    const err = new Error(detail?.error?.message || detail?.error || detail?.message || `Request failed (${res.status})`);
    (err as any).status = res.status;
    (err as any).detail = detail;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

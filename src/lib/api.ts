import * as Sentry from "@sentry/react";
import { supabase } from "./supabase";

// In dev with Vite proxy, relative paths work (/v1/... → localhost:3000).
// In production, VITE_API_BASE_URL must point to the Railway backend (e.g. https://api.weeber.ai).
// The proxy in vite.config.ts intercepts /v1 requests in dev even when BASE_URL is set,
// so we always clear it in dev mode to avoid double-prefixing.
const BASE_URL = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL ?? "");

const TIMEOUT_MS = 15_000;

class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (data.session?.access_token) {
    headers["Authorization"] = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (res.status === 401) {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        await supabase.auth.signOut();
        window.location.href = "/login";
        throw new ApiError(401, "unauthorized", "Session expired");
      }
      const retryHeaders = await getAuthHeaders();
      const retry = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: retryHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({}));
        throw new ApiError(retry.status, err?.error?.code || "error", err?.error?.message || retry.statusText);
      }
      return retry.json() as Promise<T>;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const apiErr = new ApiError(res.status, err?.error?.code || "error", err?.error?.message || res.statusText, err?.error?.details);
      
      if (res.status >= 400) {
        Sentry.captureException(apiErr, {
          extra: {
            method,
            path,
            status: res.status,
            apiErrorCode: err?.error?.code,
            details: err?.error?.details,
          },
          tags: {
            component: "api-client",
            status: String(res.status),
          }
        });
      }
      throw apiErr;
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export { ApiError };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export async function joinWaitlist(data: { name: string; email: string; phone?: string; ref?: string }): Promise<{ success: boolean; duplicate?: boolean; referral_code?: string; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/waitlist-join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ ...data, source: "website" }),
    });
    if (res.ok) {
      return res.json();
    }
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err?.error?.message || "Something went wrong" };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

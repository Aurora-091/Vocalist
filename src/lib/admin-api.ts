import { api } from "./api";

export interface AdminStats {
  total_users: number;
  waitlist_pending: number;
  active_users_7d: number;
  calls_today: number;
  monthly_cost: number;
  active_subscriptions: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  platform_role: string | null;
  created_at: string;
  org_id: string;
  orgs: { name: string; plan_id: string } | null;
}

export interface AdminUserDetail extends AdminUser {
  usage: Record<string, number>;
  last_active: string | null;
}

export interface WaitlistEntry {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  source: string;
  status: string;
  referral_code: string | null;
  referrals_count: number;
  referred_by: string | null;
  unsubscribed: boolean;
  created_at: string;
}

export interface AdminAgent {
  id: string;
  name: string;
  org_id: string;
  provider: string;
  vertical: string | null;
  created_at: string;
  orgs: { name: string } | null;
}

export interface BillingEntry {
  id: string;
  org_id: string;
  plan_id: string;
  status: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  orgs: { name: string } | null;
}

export interface LogEntry {
  id: string;
  org_id: string | null;
  source: string;
  event_type: string;
  error_message: string | null;
  retry_count: number;
  resolved_at: string | null;
  created_at: string;
}

export interface PlatformSettings {
  [key: string]: { value: unknown; updated_at: string };
}

export const adminApi = {
  checkAccess: () => api.get<{ platform_role: string }>("/v1/admin/me"),
  getStats: () => api.get<AdminStats>("/v1/admin/stats"),
  getRecentSignups: () => api.get<AdminUser[]>("/v1/admin/recent-signups"),
  getRecentErrors: () => api.get<LogEntry[]>("/v1/admin/recent-errors"),
  listUsers: (opts: { page?: number; limit?: number; q?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.page) params.set("page", String(opts.page));
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.q) params.set("q", opts.q);
    return api.get<PaginatedResult<AdminUser>>(`/v1/admin/users?${params}`);
  },
  getUserDetail: (id: string) => api.get<AdminUserDetail>(`/v1/admin/users/${id}`),
  updateUser: (id: string, data: Record<string, unknown>) => api.patch<AdminUser>(`/v1/admin/users/${id}`, data),
  listWaitlist: (opts: { page?: number; limit?: number; q?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.page) params.set("page", String(opts.page));
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.q) params.set("q", opts.q);
    if (opts.status) params.set("status", opts.status);
    return api.get<PaginatedResult<WaitlistEntry>>(`/v1/admin/waitlist?${params}`);
  },
  updateWaitlistStatus: (id: string, status: string) => api.patch<WaitlistEntry>(`/v1/admin/waitlist/${id}`, { status }),
  bulkUpdateWaitlist: (ids: string[], status: string) => api.post<{ updated: number }>("/v1/admin/waitlist/bulk", { ids, status }),
  listAgents: (opts: { page?: number; limit?: number; q?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.page) params.set("page", String(opts.page));
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.q) params.set("q", opts.q);
    return api.get<PaginatedResult<AdminAgent>>(`/v1/admin/agents?${params}`);
  },
  getAgentDetail: (id: string) => api.get<any>(`/v1/admin/agents/${id}`),
  listBilling: (opts: { page?: number; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.page) params.set("page", String(opts.page));
    if (opts.limit) params.set("limit", String(opts.limit));
    return api.get<PaginatedResult<BillingEntry>>(`/v1/admin/billing?${params}`);
  },
  listLogs: (opts: { page?: number; limit?: number; severity?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.page) params.set("page", String(opts.page));
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.severity) params.set("severity", opts.severity);
    return api.get<PaginatedResult<LogEntry>>(`/v1/admin/logs?${params}`);
  },
  getSettings: () => api.get<PlatformSettings>("/v1/admin/settings"),
  updateSetting: (key: string, value: unknown) => api.patch("/v1/admin/settings", { key, value }),
};

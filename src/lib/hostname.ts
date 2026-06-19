const ADMIN_HOST = import.meta.env.VITE_ADMIN_HOST || "admin.weeber.ai";
const APP_HOST = import.meta.env.VITE_APP_HOST || "app.weeber.ai";

export const isAdminApp =
  window.location.hostname === ADMIN_HOST ||
  window.location.hostname === "admin.localhost";

export const isAppDomain =
  window.location.hostname === APP_HOST ||
  window.location.hostname === "app.localhost";

export const isMarketingDomain = !isAdminApp && !isAppDomain;

const APP_PROTOCOL = window.location.protocol;
const APP_PORT = window.location.port ? `:${window.location.port}` : "";

export function appUrl(path: string): string {
  if (isAppDomain) return path;
  return `${APP_PROTOCOL}//${APP_HOST}${APP_PORT}${path}`;
}

export function marketingUrl(path: string): string {
  if (isMarketingDomain) return path;
  const host = import.meta.env.VITE_MARKETING_HOST || "weeber.ai";
  return `${APP_PROTOCOL}//${host}${APP_PORT}${path}`;
}

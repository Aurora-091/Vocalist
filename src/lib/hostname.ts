const ADMIN_HOST = import.meta.env.VITE_ADMIN_HOST || "admin.localhost";

export const isAdminApp =
  window.location.hostname === ADMIN_HOST ||
  window.location.hostname === "admin.localhost";

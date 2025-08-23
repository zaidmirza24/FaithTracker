// Prefer env var; fall back to same-origin "/api" (works if you reverse-proxy)
export const API_BASE =
  import.meta.env.VITE_API_BASE || `${window.location.origin}/api`;

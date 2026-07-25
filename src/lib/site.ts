// Central site constants used for canonical URLs, og:image, and JSON-LD.
export const SITE_URL = "https://upwatch.online";
export const SITE_NAME = "UpWatch";
export const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

/** Public status page on this site (always works). */
export const STATUS_PAGE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_STATUS_PAGE_URL) ||
  process.env.VITE_STATUS_PAGE_URL ||
  `${SITE_URL}/status`;

/** External Uptime Kuma status page URL when deployed (optional). */
export const KUMA_PUBLIC_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_KUMA_PUBLIC_URL) ||
  process.env.VITE_KUMA_PUBLIC_URL ||
  "https://status.upwatch.online/status/upwatch";

/** Push monitor URL for Uptime Kuma (no query string — Kuma adds status/msg/ping). */
export const KUMA_PUSH_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_KUMA_PUSH_URL) ||
  process.env.VITE_KUMA_PUSH_URL ||
  "https://status.upwatch.online/api/push/5pyQgQR1m8";

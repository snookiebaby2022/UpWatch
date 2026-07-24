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
  "";

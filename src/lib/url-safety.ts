// Best-effort SSRF guard: reject URLs whose hostname is literal loopback,
// private (RFC 1918), link-local, IPv6 loopback/ULA, or the cloud metadata
// address (169.254.169.254). Cannot defeat DNS rebinding — for that you'd
// need to resolve and pin the IP at fetch time. Blocks the common cases.
const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local incl. cloud metadata
  /^0\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i, // IPv6 unique-local
  /^fe80:/i, // IPv6 link-local
];

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

export function isPublicHttpUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Not a valid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http(s) URLs are allowed" };
  }
  const host = url.hostname;
  if (!host) return { ok: false, reason: "Missing hostname" };
  if (PRIVATE_HOST_PATTERNS.some((p) => p.test(host))) {
    return { ok: false, reason: "Private, loopback, and metadata addresses are not allowed" };
  }
  return { ok: true, url };
}

/** Client-side error reporting — logs in dev, silent in prod unless configured. */
export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);

  if (import.meta.env.DEV) {
    console.error("[UpWatch]", message, context, error);
  }
}

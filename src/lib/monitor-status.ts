/** Map monitor status between text API values and legacy integer DB columns (0=pending, 1=up, 2=down). */
export type MonitorStatus = "pending" | "up" | "down";

export function normalizeMonitorStatus(value: string | number | null | undefined): MonitorStatus {
  if (value === 1 || value === "1" || value === "up") return "up";
  if (value === 2 || value === "2" || value === "down") return "down";
  return "pending";
}

export function monitorStatusToDb(value: MonitorStatus): string | number {
  // Prefer text; callers retry with integer when Postgres returns 22P02.
  return value;
}

export function monitorStatusToLegacyInt(value: MonitorStatus): number {
  if (value === "up") return 1;
  if (value === "down") return 2;
  return 0;
}

export function legacyIntsForPendingMatch(): Array<string | number> {
  return ["pending", "0", 0, ""];
}

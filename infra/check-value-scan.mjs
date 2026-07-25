/** One-off: run Value Scan check and set integer last_status on legacy schema. */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
if (existsSync(join(root, ".env"))) {
  for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
  }
}

const url = env.SUPABASE_URL || "https://zjijihumvmijnijpkwpz.supabase.co";
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
const monitorId = "c661cfb6-8d5e-4681-8a2a-f42f5ac5882b";
const target = "https://valuescan.online/";

const started = Date.now();
const res = await fetch(target, { redirect: "follow" });
const ms = Date.now() - started;
const status = res.ok ? 1 : 2;
const now = new Date().toISOString();

await fetch(`${url}/rest/v1/check_results`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({
    monitor_id: monitorId,
    status: status === 1 ? "up" : "down",
    response_time_ms: ms,
    status_code: res.status,
    error_message: res.ok ? null : `HTTP ${res.status}`,
  }),
});

const patch = await fetch(`${url}/rest/v1/monitors?id=eq.${monitorId}`, {
  method: "PATCH",
  headers: h,
  body: JSON.stringify({ last_status: status, last_checked_at: now }),
});
console.log("patch", patch.status, await patch.text());

const row = await fetch(`${url}/rest/v1/monitors?id=eq.${monitorId}&select=name,last_status,last_checked_at`, { headers: h }).then((r) => r.json());
console.log("monitor now", row);

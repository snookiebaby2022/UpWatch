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

const id = "c661cfb6-8d5e-4681-8a2a-f42f5ac5882b";
const patch = await fetch(`${url}/rest/v1/monitors?id=eq.${id}`, {
  method: "PATCH",
  headers: h,
  body: JSON.stringify({ last_status: "pending", last_checked_at: null }),
});
console.log("patch status", patch.status, await patch.text());

const row = await fetch(`${url}/rest/v1/monitors?id=eq.${id}&select=*`, { headers: h }).then((r) => r.json());
console.log("after patch", row);

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const env = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
  }
}

const url = env.SUPABASE_URL || "https://zjijihumvmijnijpkwpz.supabase.co";
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const publishable = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
const h = { Authorization: `Bearer ${key}`, apikey: key };

const users = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: h }).then((r) => r.json());
const list = users.users || [];
const matches = list.filter((u) => (u.email || "").toLowerCase().includes("snookie"));
console.log("Users:", JSON.stringify(matches.map((u) => ({ id: u.id, email: u.email, providers: u.app_metadata?.providers })), null, 2));

for (const u of matches) {
  const roles = await fetch(`${url}/rest/v1/user_roles?user_id=eq.${u.id}&select=role`, { headers: h }).then((r) => r.json());
  console.log("Roles for", u.email, roles);
}

const mons = await fetch(
  `${url}/rest/v1/monitors?select=id,name,url,type,keyword,last_status,last_checked_at,user_id&order=created_at.desc&limit=10`,
  { headers: h },
).then((r) => r.json());
console.log("Monitors:", JSON.stringify(mons, null, 2));

if (matches[0]) {
  const rpc = await fetch(`${url}/rest/v1/rpc/has_role`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ _user_id: matches[0].id, _role: "admin" }),
  }).then(async (r) => ({ status: r.status, body: await r.text() }));
  console.log("has_role rpc:", rpc);
}

const cron = await fetch("https://upwatch.online/api/public/hooks/run-monitors", {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: publishable || "" },
  body: "{}",
}).then(async (r) => ({ status: r.status, body: await r.text() }));
console.log("run-monitors:", cron);

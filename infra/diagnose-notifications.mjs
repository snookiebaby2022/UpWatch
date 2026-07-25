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
if (!key) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };

for (const table of ["notifications", "support_tickets", "support_ticket_messages"]) {
  const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=3`, { headers: h });
  const body = await r.text();
  console.log(`\n${table} → HTTP ${r.status}`);
  console.log(body.slice(0, 500));
}

// List ticket owners for reference
const tickets = await fetch(`${url}/rest/v1/support_tickets?select=id,subject,user_id&limit=5`, { headers: h });
console.log("\nRecent tickets:", await tickets.text());

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
const h = { Authorization: `Bearer ${key}`, apikey: key };

for (const table of ["support_tickets", "support_ticket_messages"]) {
  const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, { headers: h });
  console.log(`\n${table} ${r.status}`);
  console.log(await r.text());
}

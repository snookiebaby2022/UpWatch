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

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.argv[2] || "1d0e6c86-f9a1-4c7c-84a8-c1d742270835";

const h = {
  Authorization: `Bearer ${key}`,
  apikey: key,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const r = await fetch(`${url}/rest/v1/notifications`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({
    user_id: userId,
    type: "ticket_reply",
    title: "Support replied: Heyyyy",
    body: "Test notification from diagnose script",
    link: "/tickets",
  }),
});
console.log("insert status:", r.status);
console.log(await r.text());

// Verify customer can read (simulate with service role filtered)
const r2 = await fetch(
  `${url}/rest/v1/notifications?user_id=eq.${userId}&select=id,title,read,created_at&order=created_at.desc&limit=5`,
  { headers: h },
);
console.log("\nnotifications for user:", await r2.text());

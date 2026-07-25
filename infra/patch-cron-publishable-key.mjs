/**
 * Reschedule pg_cron run-monitors job with the current Supabase publishable key.
 * Called from infra/sync-supabase-keys.mjs after key rotation.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = "zjijihumvmijnijpkwpz";

function loadEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m && process.env[m[1].trim()] === undefined) {
      process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
    }
  }
}

function sqlEscape(value) {
  return value.replace(/'/g, "''");
}

async function runSql(sql, token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Database query ${res.status}: ${body.slice(0, 300)}`);
  }
  return body;
}

loadEnv();

const publishable =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!publishable) {
  console.error("Missing SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}
if (!token) {
  console.warn("Skipping pg_cron patch — set SUPABASE_ACCESS_TOKEN in .env to auto-update cron apikey");
  process.exit(0);
}

const headersJson = JSON.stringify({
  "Content-Type": "application/json",
  apikey: publishable,
});

const sql = `
SELECT cron.unschedule('upwatch-run-monitors');
SELECT cron.schedule(
  'upwatch-run-monitors',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://upwatch.online/api/public/hooks/run-monitors',
    headers := '${sqlEscape(headersJson)}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
`;

console.log("Updating pg_cron run-monitors apikey…");
await runSql(sql, token);
console.log("pg_cron job updated with current publishable key.");

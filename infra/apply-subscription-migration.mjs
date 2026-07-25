/**
 * Apply subscription-on-signup migration via Supabase Management API or CLI.
 * Usage: node infra/apply-subscription-migration.mjs
 */
import { execSync } from "node:child_process";
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

loadEnv();

const sql = readFileSync(
  join(root, "supabase/migrations/20260725200000_subscription_on_signup.sql"),
  "utf8",
);

async function runViaManagementApi(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 400)}`);
}

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();

try {
  if (token) {
    await runViaManagementApi(token);
    console.log("Subscription migration applied (Management API).");
  } else {
    execSync("npx supabase db push --linked", { cwd: root, stdio: "inherit", shell: true });
    console.log("Subscription migration applied (supabase db push).");
  }
} catch {
  console.error(`
Could not apply migration automatically.

Option A — Supabase CLI:
  npx supabase login
  npx supabase db push --linked

Option B — add SUPABASE_ACCESS_TOKEN to .env, then re-run:
  node infra/apply-subscription-migration.mjs

Option C — paste this SQL in Supabase SQL Editor:
  https://supabase.com/dashboard/project/${projectRef}/sql/new

--- SQL ---
${sql}
--- end ---
`);
  process.exit(1);
}

/**
 * Apply DB fixes + grant admin + repair monitors. Requires SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = "zjijihumvmijnijpkwpz";
const OWNER_EMAIL = "snookiebaby2022@gmail.com";

function loadEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^"|"$/g, "");
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || `https://${projectRef}.supabase.co`;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!serviceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${serviceKey}`,
  apikey: serviceKey,
  "Content-Type": "application/json",
};

async function main() {
  const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=200`, { headers });
  const users = (await usersRes.json()).users ?? [];
  const owners = users.filter((u) => u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());

  for (const u of owners) {
    await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: u.id, role: "admin" }),
    });
    console.log("admin granted:", u.email, u.id);
  }

  // Reset bad last_status values
  const bad = await fetch(
    `${supabaseUrl}/rest/v1/monitors?select=id,name,last_status&or=(last_status.eq.0,last_status.is.null,last_checked_at.is.null)`,
    { headers },
  ).then((r) => r.json());
  for (const m of bad ?? []) {
    if (m.last_status === "0" || m.last_status === 0 || m.last_status == null) {
      await fetch(`${supabaseUrl}/rest/v1/monitors?id=eq.${m.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ last_status: "pending", last_checked_at: null }),
      });
      console.log("reset monitor status:", m.name, m.id);
    }
  }

  if (publishable) {
    const cron = await fetch("https://upwatch.online/api/public/hooks/run-monitors", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: publishable },
      body: "{}",
    }).then((r) => r.json());
    console.log("run-monitors:", cron);
  }

  console.log("\nIMPORTANT: Run supabase/fix-has-role-overload.sql in Supabase SQL Editor to fix has_role RPC.");
  console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

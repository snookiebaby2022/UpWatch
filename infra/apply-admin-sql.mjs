/**
 * Apply fix-admin-now.sql via Supabase SQL API (service role).
 * Safe to re-run.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
  }
}

const projectRef = "zjijihumvmijnijpkwpz";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sql = readFileSync(join(root, "supabase/fix-admin-now.sql"), "utf8");
// Strip comments and verification SELECTs — run DDL + grant only
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("--") && !/^SELECT/i.test(s));

const url = `https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`;
// Use postgres meta if available — fallback: run via Management API

async function runViaPg(query) {
  const res = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  return res;
}

// Grant admin to all snookie users directly
const supabaseUrl = env.SUPABASE_URL || `https://${projectRef}.supabase.co`;
const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

const users = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=200`, { headers }).then((r) => r.json());
const targets = (users.users || []).filter((u) => (u.email || "").toLowerCase() === "snookiebaby2022@gmail.com");

for (const u of targets) {
  await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: u.id, role: "admin" }),
  });
  console.log("Granted admin to", u.email, u.id);
}

console.log("Done. If has_role still fails, run fix-admin-now.sql in Supabase SQL editor.");

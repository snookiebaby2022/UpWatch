/**
 * Grant admin role to snookiebaby2022@gmail.com on the owned Supabase project.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env or environment.
 * Never prints secret values.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OWNER_EMAIL = "snookiebaby2022@gmail.com";
const projectRef = "zjijihumvmijnijpkwpz";

function loadEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim().replace(/^"|"$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || `https://${projectRef}.supabase.co`;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!serviceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  console.error("Run: node infra/switch-to-owned-supabase.mjs");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${serviceKey}`,
  apikey: serviceKey,
  "Content-Type": "application/json",
};

async function adminFetch(path, init = {}) {
  const res = await fetch(`${supabaseUrl}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}: ${typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

async function findUser() {
  const data = await adminFetch("/auth/v1/admin/users?page=1&per_page=200");
  const users = data.users ?? data;
  if (!Array.isArray(users)) throw new Error("Unexpected listUsers response");
  return users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) ?? null;
}

async function ensureSchema() {
  const res = await fetch(`${supabaseUrl}/rest/v1/user_roles?select=user_id&limit=1`, { headers });
  if (!res.ok) {
    const detail = await res.text();
    console.log("user_roles table missing or inaccessible — run supabase/fix-admin-now.sql in Supabase SQL Editor first.");
    console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    console.log(detail.slice(0, 200));
    process.exit(1);
  }
}

async function upsertProfile(userId) {
  try {
    await adminFetch("/rest/v1/profiles", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ id: userId, display_name: "Admin" }),
    });
  } catch (err) {
    console.warn("profiles upsert:", err instanceof Error ? err.message : err);
  }
}

async function main() {
  await ensureSchema();

  const user = await findUser();
  if (!user) {
    console.error(`No auth user found for ${OWNER_EMAIL}. Sign in with Google first, then re-run.`);
    process.exit(1);
  }

  await upsertProfile(user.id);

  await adminFetch("/rest/v1/user_roles", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: user.id, role: "admin" }),
  });

  const roles = await adminFetch(`/rest/v1/user_roles?user_id=eq.${user.id}&select=role`);
  console.log(JSON.stringify({ ok: true, email: OWNER_EMAIL, userId: user.id, roles }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

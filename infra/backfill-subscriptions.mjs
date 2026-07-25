/**
 * Backfill starter subscriptions for users missing a row (service role — no SQL editor needed).
 * The handle_new_user() trigger still needs the migration SQL once (see apply-subscription-migration.mjs).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let page = 1;
let backfilled = 0;
const userIds = [];

while (page <= 20) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  for (const u of data.users) userIds.push(u.id);
  if (data.users.length < 200) break;
  page++;
}

for (const userId of userIds) {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) continue;

  const { error } = await admin.from("subscriptions").insert({
    user_id: userId,
    plan: "starter",
    status: "active",
  });
  if (error) {
    console.error("insert failed", userId, error.message);
    continue;
  }
  backfilled++;
}

console.log(`Backfilled ${backfilled} subscription row(s) for ${userIds.length} user(s).`);

/**
 * Fetch Supabase secret key and sync to Cloudflare Worker.
 * Requires SUPABASE_ACCESS_TOKEN (Owner PAT) OR SUPABASE_SERVICE_ROLE_KEY in env.
 * Never prints secret values.
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const projectRef = "zjijihumvmijnijpkwpz";

function loadEnv() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim().replace(/^"|"$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

function saveServiceRoleKey(key) {
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const kept = lines.filter((l) => !/^\s*SUPABASE_SERVICE_ROLE_KEY=/.test(l));
  kept.push(`SUPABASE_SERVICE_ROLE_KEY="${key}"`);
  writeFileSync(envPath, kept.filter((l, i, a) => l !== "" || i < a.length - 1).join("\n") + "\n", "utf8");
}

async function fetchSecretKey() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/api-keys?reveal=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Management API ${res.status}: ${body.slice(0, 200)}`);
  }
  const keys = await res.json();
  const secret =
    keys.find((k) => k.type === "secret" && k.api_key) ??
    keys.find((k) => /secret|service_role/i.test(k.name ?? "") && k.api_key);
  return secret?.api_key ?? null;
}

function ensureWranglerConfig() {
  const configPath = join(root, ".output/server/wrangler.json");
  if (existsSync(configPath)) return configPath;
  execSync("npm run build", { cwd: root, stdio: "inherit" });
  const j = JSON.parse(readFileSync(configPath, "utf8"));
  j.name = "upwatch";
  if (j.assets?.directory) j.assets.directory = j.assets.directory.replace(/\\/g, "/");
  writeFileSync(configPath, JSON.stringify(j, null, 2));
  return configPath;
}

function putSecret(name, value, configPath) {
  const r = spawnSync(
    "npx",
    ["wrangler", "secret", "put", name, "--config", configPath],
    { cwd: root, input: value, encoding: "utf8", shell: true },
  );
  if (r.status !== 0) {
    throw new Error(`wrangler secret put ${name} failed: ${r.stderr || r.stdout}`);
  }
}

loadEnv();

let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!serviceRoleKey) {
  console.log("Fetching secret key from Supabase Management API...");
  serviceRoleKey = await fetchSecretKey();
}
if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Set SUPABASE_ACCESS_TOKEN (Owner PAT) or paste the key:");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=sb_secret_... node infra/sync-service-role.mjs");
  process.exit(1);
}

saveServiceRoleKey(serviceRoleKey);
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
if (!process.env.SUPABASE_PUBLISHABLE_KEY) {
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

const configPath = ensureWranglerConfig();
console.log("Syncing secrets to Cloudflare Worker upwatch...");
for (const name of [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "KUMA_BASE_URL",
  "KUMA_STATUS_PAGE_SLUG",
]) {
  const val = process.env[name];
  if (val) {
    putSecret(name, val, configPath);
    console.log(`  ${name} set`);
  }
}
console.log("Done. Google server sign-in should work now.");

/**
 * Fetch current Supabase API keys, validate, sync to Cloudflare Worker + GitHub secrets,
 * rebuild client bundle, deploy, and verify auth.
 *
 * Requires ONE of:
 *   - supabase CLI logged in (`npx supabase login`)
 *   - SUPABASE_ACCESS_TOKEN in .env (Owner PAT)
 *   - Valid SUPABASE_* keys already in .env (sync only)
 *
 * Usage:
 *   node infra/sync-supabase-keys.mjs
 *   node infra/sync-supabase-keys.mjs --skip-deploy
 *   node infra/sync-supabase-keys.mjs --skip-github
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const projectRef = "zjijihumvmijnijpkwpz";
const skipDeploy = process.argv.includes("--skip-deploy");
const skipGithub = process.argv.includes("--skip-github");

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

function saveEnv(map) {
  writeFileSync(
    envPath,
    [...map.entries()].map(([k, v]) => `${k}="${v}"`).join("\n") + "\n",
    "utf8",
  );
}

async function fetchKeysFromManagementApi() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) return null;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/api-keys?reveal=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Management API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function fetchKeysFromCli() {
  const tmp = join(root, ".tmp-supabase-keys.json");
  try {
    execSync(
      `npx supabase projects api-keys --project-ref ${projectRef} --reveal -o json`,
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true },
    );
  } catch (err) {
    return null;
  }
  try {
    const out = execSync(
      `npx supabase projects api-keys --project-ref ${projectRef} --reveal -o json`,
      { cwd: root, encoding: "utf8", shell: true },
    );
    writeFileSync(tmp, out);
    const keys = JSON.parse(readFileSync(tmp, "utf8"));
    unlinkSync(tmp);
    return keys;
  } catch {
    if (existsSync(tmp)) unlinkSync(tmp);
    return null;
  }
}

function pickKeys(keys) {
  const publishable =
    keys.find((k) => k.type === "publishable" && k.api_key)?.api_key ??
    keys.find((k) => /publishable/i.test(k.name ?? "") && k.api_key)?.api_key;
  const secret =
    keys.find((k) => k.type === "secret" && k.api_key)?.api_key ??
    keys.find((k) => /secret|service_role/i.test(k.name ?? "") && k.api_key)?.api_key;
  if (!publishable || !secret) {
    throw new Error("Could not resolve publishable + secret keys from Supabase");
  }
  return { publishable, secret };
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

function putGithubSecret(name, value) {
  const r = spawnSync("gh", ["secret", "set", name, "-R", "snookiebaby2022/UpWatch"], {
    cwd: root,
    input: value,
    encoding: "utf8",
    shell: true,
  });
  if (r.status !== 0) {
    throw new Error(`gh secret set ${name} failed: ${r.stderr || r.stdout}`);
  }
}

function ensureWranglerConfig() {
  const configPath = join(root, ".output/server/wrangler.json");
  if (!existsSync(configPath)) {
    execSync("npm run build", { cwd: root, stdio: "inherit", env: process.env });
  }
  const j = JSON.parse(readFileSync(configPath, "utf8"));
  j.name = "upwatch";
  j.triggers = { crons: ["*/2 * * * *"] };
  if (j.assets?.directory) j.assets.directory = j.assets.directory.replace(/\\/g, "/");
  writeFileSync(configPath, JSON.stringify(j, null, 2));
  execSync("node infra/patch-kuma-cron.mjs", { cwd: root, stdio: "inherit" });
  return configPath;
}

loadEnv();

console.log("\n=== Sync Supabase keys → Worker + GitHub ===\n");

let keysJson =
  (await fetchKeysFromManagementApi()) ??
  fetchKeysFromCli();

let publishable;
let secret;

if (keysJson) {
  ({ publishable, secret } = pickKeys(keysJson));
  console.log("Fetched fresh keys from Supabase");
} else {
  publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publishable || !secret) {
    console.error(
      "Could not fetch keys. Run `npx supabase login` or set SUPABASE_ACCESS_TOKEN in .env",
    );
    process.exit(1);
  }
  console.log("Using keys from .env (could not fetch from Supabase API)");
}

const supabaseUrl = `https://${projectRef}.supabase.co`;
const envMap = new Map([
  ["SUPABASE_URL", supabaseUrl],
  ["VITE_SUPABASE_URL", supabaseUrl],
  ["SUPABASE_PROJECT_ID", projectRef],
  ["VITE_SUPABASE_PROJECT_ID", projectRef],
  ["SUPABASE_PUBLISHABLE_KEY", publishable],
  ["VITE_SUPABASE_PUBLISHABLE_KEY", publishable],
  ["SUPABASE_SERVICE_ROLE_KEY", secret],
]);
saveEnv(envMap);
for (const [k, v] of envMap) process.env[k] = v;

console.log("Validating keys…");
const verify = spawnSync("node", ["infra/verify-auth-secrets.mjs"], {
  cwd: root,
  encoding: "utf8",
  shell: true,
  env: process.env,
});
process.stdout.write(verify.stdout ?? "");
process.stderr.write(verify.stderr ?? "");
if (verify.status !== 0) {
  console.error("\nKeys failed validation — not syncing stale credentials.");
  process.exit(1);
}

if (!skipGithub) {
  console.log("\nUpdating GitHub Actions secrets…");
  for (const name of [
    "SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    putGithubSecret(name, envMap.get(name) ?? process.env[name]);
    console.log(`  ${name} updated`);
  }
}

console.log("\nPatching pg_cron run-monitors apikey (if SUPABASE_ACCESS_TOKEN set)…");
execSync("node infra/patch-cron-publishable-key.mjs", {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

console.log("\nBuilding with correct VITE_* keys…");
process.env.VITE_BUILD_SHA = execSync("git rev-parse HEAD", {
  cwd: root,
  encoding: "utf8",
}).trim();
execSync("npm run build", { cwd: root, stdio: "inherit", env: process.env });

const configPath = ensureWranglerConfig();

console.log("\nSyncing Cloudflare Worker secrets…");
for (const name of [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_BUSINESS",
  "KUMA_BASE_URL",
  "KUMA_STATUS_PAGE_SLUG",
  "KUMA_PUSH_URL",
]) {
  const val =
    name === "KUMA_BASE_URL"
      ? "https://status.upwatch.online"
      : name === "KUMA_STATUS_PAGE_SLUG"
        ? "upwatch"
        : name === "KUMA_PUSH_URL"
          ? "https://status.upwatch.online/api/push/5pyQgQR1m8"
          : process.env[name];
  if (val) {
    putSecret(name, val, configPath);
    console.log(`  ${name} set`);
  }
}

if (!skipDeploy) {
  console.log("\nDeploying to Cloudflare…");
  execSync(`npx wrangler deploy --config ${configPath}`, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}

console.log("\nVerifying production…");
const post = spawnSync(
  "node",
  ["infra/verify-auth-secrets.mjs", "--url", "https://upwatch.online"],
  { cwd: root, encoding: "utf8", shell: true, env: process.env },
);
process.stdout.write(post.stdout ?? "");
if (post.status !== 0) {
  console.warn("\nProduction verification failed — wait ~30s for CDN and re-run verify.");
  process.exit(post.status ?? 1);
}

console.log("\nResetting admin via bootstrap API (requires SETUP_TOKEN on Worker)…");
if (process.env.SETUP_TOKEN?.trim()) {
  const boot = spawnSync(
    "curl",
    [
      "-s",
      "-X",
      "POST",
      "https://upwatch.online/api/public/setup/bootstrap",
      "-H",
      `x-setup-token: ${process.env.SETUP_TOKEN}`,
    ],
    { cwd: root, encoding: "utf8", shell: true },
  );
  console.log(boot.stdout?.trim() || boot.stderr?.trim());
} else {
  console.log("  skipped — SETUP_TOKEN not set in .env");
}

console.log("\nDone. Sign in at https://upwatch.online/auth");
if (process.env.SETUP_TOKEN?.trim()) {
  console.log("  Admin bootstrap available when SETUP_TOKEN is set on Worker.");
}
console.log("  Google sign-in and dashboard billing should work when Stripe secrets are configured.\n");

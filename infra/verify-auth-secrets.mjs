/**
 * Validate Supabase keys against the live API (no secret values logged).
 * Exit 0 = OK, 1 = invalid/missing.
 *
 * Usage:
 *   node infra/verify-auth-secrets.mjs
 *   node infra/verify-auth-secrets.mjs --url https://upwatch.online
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const productionUrl = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : null;

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

function mask(key) {
  if (!key || key.length < 12) return "(missing)";
  return `${key.slice(0, 14)}…${key.slice(-4)}`;
}

async function checkPublishable(url, key) {
  const res = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.text();
  if (res.ok && !/invalid api key/i.test(body)) {
    return { ok: true, detail: "health OK" };
  }
  return { ok: false, detail: body.slice(0, 120) };
}

async function checkServiceRole(url, key) {
  const res = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.text();
  if (res.ok) return { ok: true, detail: "admin API OK" };
  if (/invalid api key/i.test(body)) return { ok: false, detail: "Invalid API key" };
  return { ok: false, detail: `HTTP ${res.status}: ${body.slice(0, 80)}` };
}

async function checkProductionBundle(siteUrl, expectedPublishable) {
  try {
    const index = await fetch(siteUrl, { signal: AbortSignal.timeout(15_000) }).then((r) => r.text());
    const scripts = [...index.matchAll(/\/assets\/[^"]+\.js/g)].map((m) => m[0]);
    let foundKey = null;
    for (const script of scripts.slice(0, 8)) {
      const js = await fetch(`${siteUrl}${script}`, {
        signal: AbortSignal.timeout(15_000),
      }).then((r) => r.text());
      const m = js.match(/sb_publishable_[A-Za-z0-9_]{20,}/);
      if (m) {
        foundKey = m[0];
        break;
      }
    }
    if (!foundKey) {
      // Keys may be injected at runtime via env on SSR — skip bundle check
      return { ok: null, detail: "publishable key not embedded in client chunks (runtime env)" };
    }
    const matches = foundKey === expectedPublishable;
    return {
      ok: matches,
      detail: matches
        ? "production bundle matches env"
        : `deployed ${mask(foundKey)}, env ${mask(expectedPublishable)}`,
      key: foundKey,
    };
  } catch (err) {
    return { ok: null, detail: err instanceof Error ? err.message : "probe failed" };
  }
}

loadEnv();

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://zjijihumvmijnijpkwpz.supabase.co";
const publishable =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("\n=== Supabase auth key verification ===\n");
console.log(`Project URL: ${supabaseUrl}`);

let failed = 0;

if (!publishable) {
  console.log("FAIL publishable key: missing SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY");
  failed++;
} else {
  const pub = await checkPublishable(supabaseUrl, publishable);
  console.log(
    pub.ok ? "OK   publishable key:" : "FAIL publishable key:",
    mask(publishable),
    "—",
    pub.detail,
  );
  if (!pub.ok) failed++;
}

if (!serviceRole) {
  console.log("FAIL service role key: missing SUPABASE_SERVICE_ROLE_KEY");
  failed++;
} else {
  const svc = await checkServiceRole(supabaseUrl, serviceRole);
  console.log(
    svc.ok ? "OK   service role key:" : "FAIL service role key:",
    mask(serviceRole),
    "—",
    svc.detail,
  );
  if (!svc.ok) failed++;
}

if (productionUrl) {
  const bundle = await checkProductionBundle(productionUrl.replace(/\/$/, ""), publishable ?? "");
  if (bundle.ok === true) {
    console.log("OK   production bundle key matches env");
  } else if (bundle.ok === false) {
    console.log("FAIL production bundle key mismatch —", bundle.detail);
    failed++;
    if (bundle.key) {
      const live = await checkPublishable(supabaseUrl, bundle.key);
      if (!live.ok) {
        console.log("FAIL deployed publishable key is rejected by Supabase — redeploy required");
        failed++;
      }
    }
  } else {
    console.log("WARN production bundle:", bundle.detail);
  }
}

console.log("");
if (failed) {
  console.log(`${failed} check(s) failed. Run: node infra/sync-supabase-keys.mjs`);
  process.exit(1);
}
console.log("All auth key checks passed.");
process.exit(0);

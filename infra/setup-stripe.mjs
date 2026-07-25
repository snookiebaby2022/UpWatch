/**
 * Configure Stripe products/prices, webhook, and sync secrets to GitHub + Cloudflare.
 *
 * Requires STRIPE_SECRET_KEY in .env (or pass as env var).
 * Usage:
 *   node infra/setup-stripe.mjs
 *   node infra/setup-stripe.mjs --skip-github
 *   node infra/setup-stripe.mjs --skip-deploy
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const webhookUrl = "https://upwatch.online/api/public/hooks/stripe-webhook";
const skipGithub = process.argv.includes("--skip-github");
const skipDeploy = process.argv.includes("--skip-deploy");

const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

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

function saveEnvKey(key, value) {
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  const row = `${key}="${value}"`;
  if (idx >= 0) lines[idx] = row;
  else lines.push(row);
  writeFileSync(envPath, lines.filter((l, i, a) => l.length || i < a.length - 1).join("\n") + "\n", "utf8");
  process.env[key] = value;
}

async function stripeGet(path, secret) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe GET ${path} ${res.status}`);
  return data;
}

async function stripePost(path, secret, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `Stripe POST ${path} ${res.status}`);
  return data;
}

async function ensureProduct(secret, name, metadataPlan) {
  const listed = await stripeGet("/products?active=true&limit=100", secret);
  const existing = listed.data?.find(
    (p) => p.name === name || p.metadata?.upwatch_plan === metadataPlan,
  );
  if (existing) return existing.id;

  const created = await stripePost("/products", secret, {
    name,
    "metadata[upwatch_plan]": metadataPlan,
  });
  return created.id;
}

async function ensurePrice(secret, productId, unitAmount, metadataPlan) {
  const listed = await stripeGet(`/prices?product=${productId}&active=true&limit=20`, secret);
  const existing = listed.data?.find(
    (p) =>
      p.unit_amount === unitAmount
      && p.currency === "gbp"
      && p.recurring?.interval === "month",
  );
  if (existing) return existing.id;

  const created = await stripePost("/prices", secret, {
    product: productId,
    currency: "gbp",
    unit_amount: String(unitAmount),
    "recurring[interval]": "month",
    "metadata[upwatch_plan]": metadataPlan,
  });
  return created.id;
}

async function ensureWebhook(secret) {
  const listed = await stripeGet("/webhook_endpoints?limit=100", secret);
  const existing = listed.data?.find((w) => w.url === webhookUrl);
  if (existing) {
    return { id: existing.id, secret: null };
  }

  const created = await stripePost("/webhook_endpoints", secret, {
    url: webhookUrl,
    ...Object.fromEntries(WEBHOOK_EVENTS.map((e, i) => [`enabled_events[${i}]`, e])),
  });
  return { id: created.id, secret: created.secret ?? null };
}

function putGithubSecret(name, value) {
  const r = spawnSync("gh", ["secret", "set", name, "-R", "snookiebaby2022/UpWatch"], {
    cwd: root,
    input: value,
    encoding: "utf8",
    shell: true,
  });
  if (r.status !== 0) throw new Error(`gh secret set ${name}: ${r.stderr || r.stdout}`);
}

function putWranglerSecret(name, value, configPath) {
  const r = spawnSync(
    "npx",
    ["wrangler", "secret", "put", name, "--config", configPath],
    { cwd: root, input: value, encoding: "utf8", shell: true },
  );
  if (r.status !== 0) throw new Error(`wrangler secret ${name}: ${r.stderr || r.stdout}`);
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

const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret) {
  console.error(`
Missing STRIPE_SECRET_KEY.

Add your Stripe secret key to .env:
  STRIPE_SECRET_KEY=sk_live_...

Find it at: https://dashboard.stripe.com/apikeys
Then re-run: node infra/setup-stripe.mjs
`);
  process.exit(1);
}

console.log("\n=== Stripe setup for UpWatch ===\n");

const proProduct = await ensureProduct(secret, "UpWatch Pro", "pro");
const businessProduct = await ensureProduct(secret, "UpWatch Business", "business");
console.log("Products OK");

const pricePro = await ensurePrice(secret, proProduct, 1000, "pro");
const priceBusiness = await ensurePrice(secret, businessProduct, 3000, "business");
console.log(`Price Pro:      ${pricePro}`);
console.log(`Price Business: ${priceBusiness}`);

const webhookResult = await ensureWebhook(secret);
console.log(`Webhook:        ${webhookUrl} (${webhookResult.id})`);

let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? webhookResult.secret?.trim() ?? "";

saveEnvKey("STRIPE_SECRET_KEY", secret);
saveEnvKey("STRIPE_PRICE_PRO", pricePro);
saveEnvKey("STRIPE_PRICE_BUSINESS", priceBusiness);

if (!skipGithub) {
  console.log("\nSyncing GitHub secrets…");
  for (const [name, val] of [
    ["STRIPE_SECRET_KEY", secret],
    ["STRIPE_PRICE_PRO", pricePro],
    ["STRIPE_PRICE_BUSINESS", priceBusiness],
    ...(webhookSecret ? [["STRIPE_WEBHOOK_SECRET", webhookSecret]] : []),
  ]) {
    putGithubSecret(name, val);
    console.log(`  ${name}`);
  }
}

console.log("\nSyncing Cloudflare Worker secrets…");
const configPath = ensureWranglerConfig();
for (const [name, val] of [
  ["STRIPE_SECRET_KEY", secret],
  ["STRIPE_PRICE_PRO", pricePro],
  ["STRIPE_PRICE_BUSINESS", priceBusiness],
  ...(webhookSecret ? [["STRIPE_WEBHOOK_SECRET", webhookSecret]] : []),
]) {
  putWranglerSecret(name, val, configPath);
  console.log(`  ${name}`);
}

if (!skipDeploy) {
  console.log("\nDeploying…");
  execSync(`npx wrangler deploy --config ${configPath}`, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}

console.log("\nDone. Test: dashboard → Billing → Upgrade to Pro.");
if (!webhookSecret) {
  console.log("Reminder: set STRIPE_WEBHOOK_SECRET then re-run to finish webhook auth.\n");
}

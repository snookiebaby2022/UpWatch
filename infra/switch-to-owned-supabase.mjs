import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = "zjijihumvmijnijpkwpz";
const legacyServiceRole = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!legacyServiceRole) {
  console.error("Pass legacy service role as argv or set SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const tmp = join(root, ".tmp-zji-keys.json");
const keysJson = execSync(
  `npx supabase projects api-keys --project-ref ${projectRef} --reveal -o json`,
  { cwd: root, encoding: "utf8", shell: true },
);
writeFileSync(tmp, keysJson);
const keys = JSON.parse(readFileSync(tmp, "utf8"));
unlinkSync(tmp);

const publishable =
  keys.find((k) => k.type === "publishable" && k.api_key) ??
  keys.find((k) => /publishable/i.test(k.name ?? "") && k.api_key);
const secret =
  keys.find((k) => k.type === "secret" && k.api_key) ??
  keys.find((k) => /secret/i.test(k.name ?? "") && k.api_key);

const serviceRoleKey = secret?.api_key || legacyServiceRole;
if (!publishable?.api_key) {
  console.error("Could not find publishable key for", projectRef);
  process.exit(1);
}

const envPath = join(root, ".env");
const existing = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
const map = new Map();
for (const line of existing) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (m) map.set(m[1].trim(), m[2].trim().replace(/^"|"$/g, ""));
}
map.set("SUPABASE_URL", `https://${projectRef}.supabase.co`);
map.set("SUPABASE_PROJECT_ID", projectRef);
map.set("VITE_SUPABASE_URL", `https://${projectRef}.supabase.co`);
map.set("VITE_SUPABASE_PROJECT_ID", projectRef);
map.set("SUPABASE_PUBLISHABLE_KEY", publishable.api_key);
map.set("VITE_SUPABASE_PUBLISHABLE_KEY", publishable.api_key);
map.set("SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey);
writeFileSync(envPath, [...map.entries()].map(([k, v]) => `${k}="${v}"`).join("\n") + "\n");

process.env.SUPABASE_URL = map.get("SUPABASE_URL");
process.env.SUPABASE_PUBLISHABLE_KEY = publishable.api_key;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
process.env.KUMA_BASE_URL = map.get("KUMA_BASE_URL") || "https://status.upwatch.online";
process.env.KUMA_STATUS_PAGE_SLUG = map.get("KUMA_STATUS_PAGE_SLUG") || "upwatch";

let configPath = join(root, ".output/server/wrangler.json");
if (!existsSync(configPath)) {
  execSync("npm run build", { cwd: root, stdio: "inherit" });
}

function patchWrangler() {
  const wrangler = JSON.parse(readFileSync(configPath, "utf8"));
  wrangler.name = "upwatch";
  if (wrangler.assets?.directory) {
    wrangler.assets.directory = wrangler.assets.directory.replace(/\\/g, "/");
  }
  writeFileSync(configPath, JSON.stringify(wrangler, null, 2));
}

patchWrangler();

function putSecret(name, value) {
  const r = spawnSync("npx", ["wrangler", "secret", "put", name, "--config", configPath], {
    cwd: root,
    input: value,
    encoding: "utf8",
    shell: true,
  });
  if (r.status !== 0) throw new Error(`wrangler secret put ${name} failed: ${r.stderr || r.stdout}`);
}

console.log(`Configured UpWatch for Supabase project ${projectRef}`);
for (const name of [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "KUMA_BASE_URL",
  "KUMA_STATUS_PAGE_SLUG",
]) {
  const val = process.env[name];
  if (val) {
    putSecret(name, val);
    console.log(`  ${name} synced to worker`);
  }
}

process.env.VITE_SUPABASE_URL = map.get("VITE_SUPABASE_URL");
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = publishable.api_key;
execSync("npm run build", { cwd: root, stdio: "inherit", env: { ...process.env } });
patchWrangler();
execSync(`npx wrangler deploy --config ${configPath}`, { cwd: root, stdio: "inherit" });
console.log("Deployed. Hard-refresh https://upwatch.online/auth and try Google sign-in.");

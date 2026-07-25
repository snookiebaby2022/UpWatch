/**
 * Inject Kuma push heartbeat into Cloudflare Worker scheduled handler.
 * Nitro's cron trigger fires but server.ts scheduled / plugins aren't in index.mjs.
 */
import fs from "node:fs";

const indexPath = ".output/server/index.mjs";
const src = fs.readFileSync(indexPath, "utf8");

const marker = "/* kuma-cron */";
if (src.includes(marker)) {
  console.log("kuma-cron already patched");
  process.exit(0);
}

const needle = `scheduled(controller, env, context) {
\t\t\tglobalThis.__env__ = env;`;

const replacement = `scheduled(controller, env, context) {
\t\t\tglobalThis.__env__ = env;
\t\t\tcontext.waitUntil((async () => { ${marker}
\t\t\t\ttry {
\t\t\t\t\tconst base = (typeof process !== "undefined" && process.env?.KUMA_PUSH_URL) || "https://status.upwatch.online/api/push/5pyQgQR1m8";
\t\t\t\t\tconst url = base.replace(/\\?.*$/, "") + "?status=up&msg=" + encodeURIComponent("UpWatch cron") + "&ping=1";
\t\t\t\t\tconst res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(10000) });
\t\t\t\t\tconst body = await res.text();
\t\t\t\t\tif (!body.includes('"ok"') && !res.ok) console.warn("[kuma-cron] push failed:", res.status, body.slice(0, 80));
\t\t\t\t} catch (err) {
\t\t\t\t\tconsole.error("[kuma-cron] error", err);
\t\t\t\t}
\t\t\t})());`;

if (!src.includes(needle)) {
  console.error("Could not find scheduled handler anchor in index.mjs — Nitro layout may have changed.");
  process.exit(1);
}

fs.writeFileSync(indexPath, src.replace(needle, replacement));
console.log("Patched index.mjs with Kuma cron heartbeat");

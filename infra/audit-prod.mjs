const localSha = process.argv[2] ?? "unknown";
const checks = [];

async function get(url) {
  const r = await fetch(url, { redirect: "follow" });
  return { status: r.status, text: await r.text(), url: r.url };
}

const health = await get("https://upwatch.online/api/public/setup/health");
checks.push({ name: "auth health", ok: health.status === 200 && health.text.includes('"ok":true') });

const home = await get("https://upwatch.online/");
const buildMeta = home.text.match(/name="upwatch-build"\s+content="([^"]+)"/);
const prodSha = buildMeta?.[1] ?? "not found";
checks.push({ name: "build sha on prod", prodSha, localSha, match: prodSha.startsWith(localSha.slice(0, 7)) || prodSha === localSha });

const dash = await get("https://upwatch.online/dashboard");
checks.push({ name: "dashboard route", ok: dash.status === 200, hasDashboardBundle: /dashboard-[A-Za-z0-9_-]+\.js/.test(dash.text) });

let checkoutProbe = { ok: false, detail: "skipped" };
try {
  const r = await fetch("https://upwatch.online/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"plan":"pro"}',
  });
  checkoutProbe = { ok: r.status === 401, detail: `status ${r.status} (401 expected without auth)` };
} catch (e) {
  checkoutProbe = { ok: false, detail: String(e) };
}
checks.push({ name: "stripe checkout route", ...checkoutProbe });

console.log(JSON.stringify({ checks, prodSha, localSha }, null, 2));

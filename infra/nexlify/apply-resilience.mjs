/**
 * Cloudflare diagnostics + resilience for nexlify.live
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node infra/nexlify/apply-resilience.mjs
 *
 * Requires API token with: Account.Workers Scripts Read/Edit, Zone.Read, Workers Routes Edit
 */
const DOMAIN = process.env.NEXLIFY_DOMAIN ?? "nexlify.live";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const WARM_URL = process.env.NEXLIFY_WARM_URL ?? `https://${DOMAIN}/`;

if (!TOKEN || !ACCOUNT_ID) {
  console.error("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function cf(method, path, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`${method} ${path}: ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.result;
}

async function main() {
  console.log(`\n=== Nexlify resilience: ${DOMAIN} ===\n`);

  // 1) Find zone
  const zones = await cf("GET", `/zones?name=${DOMAIN}`);
  const zone = zones[0];
  if (!zone) throw new Error(`Zone not found for ${DOMAIN}`);
  console.log(`Zone: ${zone.name} (${zone.id}) plan=${zone.plan?.name ?? "unknown"}`);

  // 2) Recent 502 signals via GraphQL Workers analytics (last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const gql = `
    query($zoneTag: String!, $since: Time!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1hGroups(limit: 24, filter: { datetime_geq: $since }) {
            dimensions { datetime }
            sum { status502 responses }
          }
        }
      }
    }`;
  try {
    const analytics = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({ query: gql, variables: { zoneTag: zone.id, since } }),
    }).then((r) => r.json());
    const groups = analytics?.data?.viewer?.zones?.[0]?.httpRequests1hGroups ?? [];
    const total502 = groups.reduce((n, g) => n + (g.sum?.status502 ?? 0), 0);
    const totalReq = groups.reduce((n, g) => n + (g.sum?.responses ?? 0), 0);
    console.log(`\n502 errors (24h): ${total502} / ${totalReq} requests`);
    const hoursWith502 = groups.filter((g) => (g.sum?.status502 ?? 0) > 0);
    if (hoursWith502.length) {
      console.log("Hours with 502 spikes:");
      for (const h of hoursWith502.slice(-8)) {
        console.log(`  ${h.dimensions.datetime}: ${h.sum.status502} x 502`);
      }
    } else {
      console.log("No 502 spikes in zone analytics (last 24h) — failures may be edge-only or below sampling.");
    }
  } catch (err) {
    console.warn("Analytics query skipped:", err instanceof Error ? err.message : err);
  }

  // 3) List Workers / Pages projects on account
  console.log("\nWorkers on account:");
  let workers = [];
  try {
    workers = await cf("GET", `/accounts/${ACCOUNT_ID}/workers/scripts`);
    for (const w of workers.slice(0, 15)) {
      console.log(`  - ${w.id ?? w}`);
    }
  } catch {
    console.log("  (could not list — token may need Workers Scripts:Read)");
  }

  // 4) Deploy keep-warm cron worker (reduces cold-start 502s on Next.js/Workers)
  const workerName = "nexlify-keep-warm";
  const workerScript = `
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(warm(env));
  },
  async fetch() {
    return new Response(JSON.stringify({ ok: true, worker: "${workerName}" }), {
      headers: { "content-type": "application/json" },
    });
  },
};

async function warm(env) {
  const url = env.WARM_URL || "${WARM_URL}";
  const paths = (env.WARM_PATHS || "/,/pricing").split(",");
  for (const path of paths) {
    const target = new URL(path.trim(), url).toString();
    try {
      const res = await fetch(target, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; nexlify-keep-warm/1.0)",
          "accept": "text/html,application/xhtml+xml",
          "cache-control": "no-cache",
        },
        cf: { cacheTtl: 0 },
      });
      console.log("[warm]", target, res.status);
    } catch (err) {
      console.error("[warm]", target, err?.message || err);
    }
  }
}
`.trim();

  const metadata = {
    main_module: "keep-warm.mjs",
    bindings: [
      { type: "plain_text", name: "WARM_URL", text: WARM_URL },
      { type: "plain_text", name: "WARM_PATHS", text: "/,/pricing" },
    ],
    compatibility_date: "2024-09-23",
    compatibility_flags: ["nodejs_compat"],
  };

  const form = new FormData();
  form.append("metadata", JSON.stringify(metadata));
  form.append("keep-warm.mjs", new Blob([workerScript], { type: "application/javascript+module" }), "keep-warm.mjs");

  const uploadRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${workerName}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: form,
    },
  );
  const uploadJson = await uploadRes.json();
  if (!uploadJson.success) {
    throw new Error(`Worker upload failed: ${JSON.stringify(uploadJson.errors)}`);
  }
  console.log(`\nDeployed worker: ${workerName}`);

  // Allow monitoring + keep-warm user agents through WAF (fixes intermittent 403 → false DOWN)
  const uaNeedles = ["UpWatch-Monitor", "nexlify-keep-warm", "Uptime-Kuma"];
  for (const ua of uaNeedles) {
    try {
      await cf("POST", `/zones/${zone.id}/firewall/access_rules/rules`, {
        mode: "allow",
        notes: `Allow ${ua} health checks`,
        configuration: { target: "user_agent", value: ua },
      });
      console.log(`WAF allow rule: user-agent contains "${ua}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exists") || msg.includes("81057")) {
        console.log(`WAF allow rule already present: ${ua}`);
      } else {
        console.warn(`WAF rule skipped for ${ua}:`, msg);
      }
    }
  }

  // Cron trigger every 5 minutes
  await cf("PUT", `/accounts/${ACCOUNT_ID}/workers/scripts/${workerName}/schedules`, [
    { cron: "*/5 * * * *" },
  ]);
  console.log("Cron: */5 * * * * (keep-warm ping)");

  // Smart Placement (paid plans — reduces latency/timeouts)
  try {
    await cf("PUT", `/accounts/${ACCOUNT_ID}/workers/scripts/${workerName}/settings`, {
      placement: { mode: "smart" },
    });
    console.log("Smart Placement: enabled on keep-warm worker");
  } catch {
    console.log("Smart Placement: skipped (may require Workers Paid plan)");
  }

  // 5) Live probe with retries (same logic as UpWatch monitors)
  console.log("\nLive probe (3 attempts, 30s timeout):");
  for (let i = 1; i <= 3; i++) {
    const t0 = Date.now();
    try {
      const res = await fetch(WARM_URL, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; UpWatch-Monitor/1.0; +https://upwatch.online)",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(30_000),
      });
      console.log(`  attempt ${i}: HTTP ${res.status} in ${Date.now() - t0}ms`);
      if (res.ok) break;
    } catch (err) {
      console.log(`  attempt ${i}: ${err instanceof Error ? err.message : err}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("\nDone. Check Cloudflare dashboard → Workers → nexlify-keep-warm for cron invocations.");
  console.log("For Next.js Pages project logs: dashboard → Workers & Pages → nexlify → Logs (Real-time).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

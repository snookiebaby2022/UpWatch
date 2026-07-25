const localDash = process.argv[2] ?? "";
const r = await fetch("https://upwatch.online/auth");
const html = await r.text();
const assets = [...html.matchAll(/\/assets\/([a-zA-Z0-9_-]+)\.js/g)].map((m) => m[1]);
const dash = assets.find((a) => a.startsWith("dashboard-"));
console.log("prod dashboard bundle:", dash ?? "not in auth HTML (SSR)");
console.log("local dashboard bundle:", localDash.replace(".js", "").replace("dashboard-", "dashboard-") || localDash);
console.log("match:", dash && localDash && dash === localDash.replace(".js",""));

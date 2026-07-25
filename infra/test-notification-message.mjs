import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
if (existsSync(join(root, ".env"))) {
  for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
  }
}

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const h = {
  Authorization: `Bearer ${key}`,
  apikey: key,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const r = await fetch(`${url}/rest/v1/notifications`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({
    user_id: "1d0e6c86-f9a1-4c7c-84a8-c1d742270835",
    title: "Support replied: Heyyyy",
    message: "Test with message column",
  }),
});
console.log("insert with message:", r.status, await r.text());

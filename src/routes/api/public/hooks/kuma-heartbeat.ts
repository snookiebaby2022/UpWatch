import { createFileRoute } from "@tanstack/react-router";

/** Lightweight heartbeat for the Uptime Kuma push monitor (no auth — token is in the URL). */
export const Route = createFileRoute("/api/public/hooks/kuma-heartbeat")({
  server: {
    handlers: {
      GET: async () => {
        const { pingKumaPush } = await import("@/lib/kuma-push");
        const result = await pingKumaPush({
          status: "up",
          msg: "UpWatch heartbeat",
          ping: Math.max(1, Math.round(performance.now() % 100_000)),
        });
        return json({ ok: result.ok, detail: result.detail });
      },
      POST: async () => {
        const { pingKumaPush } = await import("@/lib/kuma-push");
        const result = await pingKumaPush({
          status: "up",
          msg: "UpWatch heartbeat",
          ping: Math.max(1, Math.round(performance.now() % 100_000)),
        });
        return json({ ok: result.ok, detail: result.detail });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

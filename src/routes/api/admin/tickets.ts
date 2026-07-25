import { createFileRoute } from "@tanstack/react-router";

async function requireAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: json({ error: "unauthorized" }, 401) };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData.user) return { error: json({ error: "invalid session" }, 401) };

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) return { error: json({ error: "forbidden" }, 403) };
  return { supabaseAdmin, userId: userData.user.id };
}

export const Route = createFileRoute("/api/admin/tickets")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAdmin(request);
        if ("error" in auth && auth.error) return auth.error;
        const { supabaseAdmin } = auth;

        const url = new URL(request.url);
        const ticketId = url.searchParams.get("ticketId");
        if (!ticketId) {
          return json({ error: "ticketId required" }, 400);
        }

        const { data, error } = await supabaseAdmin
          .from("support_ticket_messages")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true });

        if (error) {
          return json({ error: error.message }, 500);
        }
        return json({ ok: true, messages: data ?? [] });
      },

      POST: async ({ request }) => {
        const auth = await requireAdmin(request);
        if ("error" in auth && auth.error) return auth.error;
        const { supabaseAdmin, userId } = auth;

        let body: { ticketId?: string; message?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid json" }, 400);
        }

        const ticketId = body.ticketId?.trim();
        const message = body.message?.trim();
        if (!ticketId || !message) {
          return json({ error: "ticketId and message required" }, 400);
        }

        const { data: ticket, error: ticketErr } = await supabaseAdmin
          .from("support_tickets")
          .select("id, status, user_id, subject")
          .eq("id", ticketId)
          .maybeSingle();

        if (ticketErr) return json({ error: ticketErr.message }, 500);
        if (!ticket) return json({ error: "ticket not found" }, 404);

        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("support_ticket_messages")
          .insert({
            ticket_id: ticketId,
            author_id: userId,
            is_admin: true,
            body: message,
          })
          .select("*")
          .single();

        if (insertErr) {
          return json({ error: insertErr.message }, 500);
        }

        if (ticket.status === "open") {
          await supabaseAdmin
            .from("support_tickets")
            .update({ status: "pending" })
            .eq("id", ticketId);
        }

        // Notify ticket owner (in-app bell + realtime toast)
        const preview = message.length > 200 ? `${message.slice(0, 197)}…` : message;
        const { error: notifyErr } = await supabaseAdmin.from("notifications").insert({
          user_id: ticket.user_id,
          type: "ticket_reply",
          title: `Support replied: ${ticket.subject}`,
          body: preview,
          link: "/tickets",
        });
        if (notifyErr) {
          console.error("ticket reply notification failed:", notifyErr.message);
        }

        return json({ ok: true, message: inserted });
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

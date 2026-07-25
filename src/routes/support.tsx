import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { useAuthNav } from "@/hooks/use-auth-nav";
import { PLAN_LABEL } from "@/lib/plans";
import { PLAN_TICKET_PRIORITY } from "@/lib/tickets";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — UpWatch" },
      {
        name: "description",
        content: "Open a support ticket from your dashboard. Priority is set automatically from your plan.",
      },
    ],
  }),
  component: PublicSupportPage,
});

function PublicSupportPage() {
  const { signedIn, homeTo } = useAuthNav();

  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Support tickets</h1>
          <p className="text-white/70 text-lg">
            Signed-in users can open tickets from the dashboard. Replies are threaded in real time,
            and admins respond from the Admin Console.
          </p>
        </div>

        <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Priority by plan</h2>
          <p className="text-sm text-white/60">
            Ticket priority is assigned automatically when you submit — you cannot spoof a higher tier
            from the client.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-widest text-white/50">
                <tr>
                  <th className="text-left py-2">Plan</th>
                  <th className="text-left py-2">Ticket priority</th>
                </tr>
              </thead>
              <tbody>
                {(["starter", "pro", "business"] as const).map((plan) => (
                  <tr key={plan} className="border-t border-white/10">
                    <td className="py-3">{PLAN_LABEL[plan]}</td>
                    <td className="py-3 capitalize">{PLAN_TICKET_PRIORITY[plan]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-3">
          <h2 className="text-lg font-semibold">How it works</h2>
          <ol className="list-decimal list-inside text-sm text-white/70 space-y-2">
            <li>Sign in to UpWatch</li>
            <li>Open <strong className="text-white">Support</strong> from your dashboard (or go to My tickets)</li>
            <li>Submit a subject and message — priority follows your subscription</li>
            <li>Track replies in the same thread; admins see tickets sorted by priority</li>
          </ol>
        </section>

        <div className="flex flex-wrap gap-3">
          {signedIn ? (
            <Link
              to="/tickets"
              className="rounded-md bg-[#10b981] px-5 py-2.5 text-black font-semibold hover:bg-[#0ea371]"
            >
              Open my tickets
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="rounded-md bg-[#10b981] px-5 py-2.5 text-black font-semibold hover:bg-[#0ea371]"
              >
                Sign in to open a ticket
              </Link>
              <Link
                to="/auth"
                className="rounded-md border border-white/20 px-5 py-2.5 text-white/80 hover:text-white"
              >
                Create account
              </Link>
            </>
          )}
          <Link to={homeTo} className="rounded-md border border-white/20 px-5 py-2.5 text-white/80 hover:text-white">
            {signedIn ? "Back to dashboard" : "Back home"}
          </Link>
        </div>
      </div>
    </MarketingLayout>
  );
}

import { Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/MarketingLayout";

interface Props {
  competitor: string;
  intro: string;
  rows: [string, string, string][]; // [feature, upwatch, competitor]
}

export function ComparePage({ competitor, intro, rows }: Props) {
  return (
    <MarketingLayout>
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-8">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          UpWatch vs {competitor}
        </h1>
        <p className="mt-4 text-white/70">{intro}</p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-12">
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/70">
              <tr>
                <th className="text-left px-4 py-3">Feature</th>
                <th className="text-left px-4 py-3">UpWatch</th>
                <th className="text-left px-4 py-3">{competitor}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([f, a, b]) => (
                <tr key={f} className="border-t border-white/10">
                  <td className="px-4 py-3 text-white/80">{f}</td>
                  <td className="px-4 py-3 text-[#10b981]">{a}</td>
                  <td className="px-4 py-3 text-white/70">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-white/50">
          Comparison based on public plan pages at time of writing. {competitor} is a trademark of its respective owner; this page is an independent comparison, not an endorsement.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <Link to="/auth" className="inline-flex rounded-md bg-[#10b981] px-6 py-3 text-black font-medium hover:bg-[#0ea371]">
          Try UpWatch free
        </Link>
      </section>
    </MarketingLayout>
  );
}

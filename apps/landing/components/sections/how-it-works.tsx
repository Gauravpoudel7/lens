import { CheckCircle2, XCircle } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/sections/section";
import { Steps } from "@/components/sections/steps";
import { RiskPill } from "@/components/ui/badge";
import { CHECKS, CHECK_COUNT, SCORING } from "@/content/copy";

export function HowItWorks() {
  return (
    <Section id="how-it-works" title="From a shill to a proved answer, in four steps.">
      <Steps />

      <Reveal className="mt-20 md:mt-28">
        <div className="text-scrim w-fit">
        <h3 className="text-2xl font-semibold tracking-tight text-ink">The {CHECK_COUNT} on-chain checks</h3>
        </div>
        <div className="glass mt-8 overflow-hidden rounded-2xl">
          <table className="w-full text-left text-base">
            <caption className="sr-only">Each check, what counts as a danger sign, and what looks good</caption>
            <thead className="hidden border-b border-white/10 text-sm text-faint md:table-header-group">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">Check</th>
                <th scope="col" className="px-6 py-4 font-medium">Danger sign</th>
                <th scope="col" className="px-6 py-4 font-medium">Good sign</th>
              </tr>
            </thead>
            <tbody>
              {CHECKS.map((c) => (
                <tr
                  key={c.check}
                  className="grid gap-2 border-b border-white/[0.06] px-5 py-5 transition-colors last:border-0 hover:bg-white/[0.02] md:table-row md:p-0"
                >
                  <th scope="row" className="font-semibold text-ink md:px-6 md:py-4">
                    {c.check}
                  </th>
                  <td className="md:px-6 md:py-4">
                    <span className="flex items-start gap-2 text-body">
                      <XCircle className="mt-0.5 size-4 shrink-0 text-high" aria-label="Danger sign" />
                      {c.danger}
                    </span>
                  </td>
                  <td className="md:px-6 md:py-4">
                    <span className="flex items-start gap-2 text-body">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-low" aria-label="Good sign" />
                      {c.good}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-6 grid gap-3 md:grid-cols-3">
          {SCORING.map((s) => (
            <div key={s.level} className="glass flex items-start gap-3 rounded-xl p-4">
              <dt>
                <RiskPill level={s.level} />
              </dt>
              <dd className="text-sm leading-relaxed text-body">{s.rule}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </Section>
  );
}

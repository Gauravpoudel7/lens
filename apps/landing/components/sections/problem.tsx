import { EyeOff, Ghost, Megaphone, ScanSearch } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/sections/section";
import { PROBLEM } from "@/content/copy";

const ICONS = [Megaphone, Ghost, EyeOff, ScanSearch];

export function Problem() {
  return (
    <Section id="problem" title={PROBLEM.title}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PROBLEM.cards.map((title, i) => {
          const Icon = ICONS[i];
          return (
            <Reveal key={title} delay={i * 0.06} className="glass rounded-2xl p-6">
              <Icon className="size-5 text-faint" aria-hidden />
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">{title}</h3>
            </Reveal>
          );
        })}
      </div>

      <Reveal className="mt-4">
        <figure className="relative overflow-hidden rounded-2xl border border-high/25 bg-[#0c0c0e]/70 backdrop-blur-xl bg-[linear-gradient(135deg,rgb(244_63_94/0.08),transparent_60%)] p-6 md:p-10">
          <figcaption className="font-mono text-sm text-[#fb7185]">{PROBLEM.libra.when}</figcaption>
          <blockquote className="mt-4 max-w-[62ch] text-xl leading-snug tracking-tight text-ink md:text-2xl">
            {PROBLEM.libra.body}
          </blockquote>
        </figure>
      </Reveal>

    </Section>
  );
}

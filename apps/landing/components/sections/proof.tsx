import { ArrowRight, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/sections/section";
import { VerifyDemo } from "@/components/sections/verify-demo";
import { PROOF } from "@/content/copy";
import { appUrl } from "@/lib/site";

export function Proof() {
  return (
    <Section id="proof" title={PROOF.title}>
      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <Reveal>
          <VerifyDemo />
        </Reveal>
        <Reveal delay={0.1} className="text-scrim lg:pt-4">
          <div className="flex items-center gap-3 text-ink">
            <Fingerprint className="size-5" aria-hidden />
            <code className="font-mono text-base">lens:v1|timestamp|sha256</code>
          </div>
          <ol className="mt-8 space-y-5">
            {PROOF.points.map((p, i) => (
              <li key={p} className="flex gap-4 text-[16px] leading-relaxed text-body">
                <span className="font-mono text-sm text-faint">{i + 1}</span>
                {p}
              </li>
            ))}
          </ol>
          <Button asChild variant="outline" className="group mt-10">
            <a href={appUrl("/verify")}>
              Verify a reply
              <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </a>
          </Button>
        </Reveal>
      </div>
    </Section>
  );
}

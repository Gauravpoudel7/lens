import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApertureMark } from "@/components/logo";
import { Magnetic } from "@/components/motion/magnetic";
import { HeroSpotlight } from "@/components/sections/hero-stage";
import { CTA, HANDLE } from "@/content/copy";
import { X_URL, appUrl } from "@/lib/site";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-3 pb-20 sm:px-4">
      <div className="relative mx-auto max-w-[1320px] overflow-hidden rounded-[28px] border border-white/10 bg-black/60 px-6 py-24 text-center md:py-36">
        <HeroSpotlight />
        <div aria-hidden className="absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sol-violet/[0.08] blur-[100px]" />
        <ApertureMark className="spin-slow relative mx-auto size-16 text-white/80" />
        <h2 id="cta-title" className="text-h2 text-gradient relative mx-auto mt-10 max-w-[18ch] font-bold">
          {CTA.title}
        </h2>
        <div className="relative mt-10 flex flex-wrap justify-center gap-3">
          <Magnetic>
            <Button asChild size="lg">
              <a href={X_URL} target="_blank" rel="noreferrer">
                Follow {HANDLE}
              </a>
            </Button>
          </Magnetic>
          <Button asChild size="lg" variant="outline" className="group">
            <a href={appUrl()}>
              See the public record
              <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

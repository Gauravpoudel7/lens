import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Magnetic } from "@/components/motion/magnetic";
import { HeroSpotlight, HeroStage } from "@/components/sections/hero-stage";
import { HANDLE, HERO } from "@/content/copy";
import { X_URL, appUrl } from "@/lib/site";

export function Hero() {
  let w = 0; // word index across lines, for the stagger delay
  return (
    <section id="top" aria-labelledby="hero-title" className="px-3 pt-20 sm:px-4">
      <Card className="relative mx-auto min-h-[min(88vh,56rem)] max-w-[1320px] overflow-hidden rounded-[28px] border-0 bg-black/60 shadow-none">
        <HeroSpotlight />
        <div aria-hidden className="drift absolute -top-1/4 -left-1/4 size-[70%] rounded-full bg-sol-violet/[0.10] blur-[120px]" />
        <div aria-hidden className="drift absolute -right-1/4 -bottom-1/3 size-[60%] rounded-full bg-sol-mint/[0.07] blur-[120px] [animation-delay:-9s]" />

        <div className="relative flex min-h-[min(88vh,56rem)] flex-col md:flex-row">
          <div className="@container relative z-10 flex flex-1 flex-col justify-center px-6 pt-16 pb-10 sm:px-10 md:py-20 lg:pl-16">
            <Badge className="fade-up w-fit gap-2 border-white/15 py-1 text-[13px]">
              <span aria-hidden className="pulse-dot size-1.5 rounded-full bg-sol-mint" />
              {HERO.eyebrow}
            </Badge>
            <h1 id="hero-title" className="text-hero text-gradient mt-6 font-bold">
              {HERO.titleLines.map((line) => (
                <span key={line} className="block whitespace-nowrap">
                  {line.split(" ").map((word, i, arr) => (
                    <span key={i} className="word-in" style={{ animationDelay: `${80 + w++ * 45}ms` }}>
                      {word}
                      {i < arr.length - 1 ? " " : ""}
                    </span>
                  ))}
                </span>
              ))}
            </h1>
            <p className="fade-up mt-6 max-w-[54ch] text-[19px] leading-relaxed text-pretty text-body [animation-delay:600ms]">
              {HERO.sub}
            </p>
            <div className="fade-up mt-9 flex flex-wrap items-center gap-3 [animation-delay:750ms]">
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
            <div className="fade-up mt-8 flex flex-wrap items-center gap-3 [animation-delay:900ms]">
              <Badge variant="proof">
                <CheckCircle2 aria-hidden />
                Proof before post
              </Badge>
            </div>
          </div>

          <div className="relative flex-1 md:min-h-[min(88vh,56rem)]">
            <HeroStage />
          </div>
        </div>
      </Card>
    </section>
  );
}

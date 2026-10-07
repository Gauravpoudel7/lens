import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/sections/section";
import { PRICING } from "@/content/copy";
import { X_URL, appUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

const HREF = { x: X_URL, pro: appUrl("/pro"), record: appUrl() };

export function Pricing() {
  return (
    <Section id="pricing" title={PRICING.title}>
      <div className="grid gap-4 lg:grid-cols-3">
        {PRICING.plans.map((plan, i) => {
          const pro = plan.cta.kind === "pro";
          return (
            <Reveal key={plan.name} delay={i * 0.06}>
              <div
                className={cn(
                  "glass flex h-full flex-col rounded-2xl p-7",
                  pro && "conic-border border-transparent",
                )}
              >
                <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
                <p className="mt-5 flex items-baseline gap-2">
                  <span className="font-mono text-4xl font-semibold tracking-tight text-ink tabular-nums">{plan.price}</span>
                  {plan.cadence && <span className="text-sm text-faint">{plan.cadence}</span>}
                </p>
                <p className="mt-2 text-base text-body">{plan.blurb}</p>
                <ul className="mt-7 flex-1 space-y-3">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-base text-body">
                      <Check className="mt-1 size-4 shrink-0 text-ink" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
                {"note" in plan && plan.note && <p className="mt-6 text-sm text-faint">{plan.note}</p>}
                <Button asChild variant={pro ? "wallet" : "outline"} className="mt-7 w-full">
                  <a
                    href={HREF[plan.cta.kind]}
                    {...(plan.cta.kind === "x" ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    {pro && (
                      <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#2775ca]">
                        $
                      </span>
                    )}
                    {plan.cta.label}
                  </a>
                </Button>
              </div>
            </Reveal>
          );
        })}
      </div>
      <p className="text-scrim mx-auto mt-8 w-fit text-center text-body">{PRICING.footnote}</p>
    </Section>
  );
}

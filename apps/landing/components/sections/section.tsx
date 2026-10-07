import { StaggerText } from "@/components/motion/stagger-text";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  sub,
  tag,
  children,
  className,
}: {
  id: string;
  title: string;
  sub?: string;
  tag?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-32", className)}>
      <div className="text-scrim mb-12 max-w-3xl md:mb-16">
        {tag && <div className="mb-5">{tag}</div>}
        <h2 id={`${id}-title`} className="text-h2 text-gradient font-bold">
          <StaggerText text={title} />
        </h2>
        {sub && (
          <Reveal delay={0.15}>
            <p className="mt-5 max-w-[60ch] text-xl leading-relaxed text-body">{sub}</p>
          </Reveal>
        )}
      </div>
      {children}
    </section>
  );
}

export function Divider() {
  return (
    <div aria-hidden className="mx-auto h-px max-w-[1200px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
  );
}

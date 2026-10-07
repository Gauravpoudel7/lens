import { Badge } from "@/components/ui/badge";
import { Counter } from "@/components/motion/counter";
import { REAL_STATS } from "@/content/copy";

function Stat({ label, value, suffix, placeholder }: { label: string; value: number; suffix: string; placeholder?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 border-t border-white/10 pt-6 text-center">
      <dt className="order-2 flex flex-wrap items-center justify-center gap-2 text-sm text-body">
        {label}
        {placeholder && <Badge variant="placeholder">Placeholder</Badge>}
      </dt>
      <dd className="order-1 text-[clamp(2.25rem,1.8rem+1.8vw,3.25rem)] leading-none font-semibold tracking-tight text-ink">
        <Counter value={value} suffix={suffix} />
      </dd>
    </div>
  );
}

export function Stats() {
  return (
    <section aria-label="Lens in numbers" className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 md:py-28">
      <dl className="text-scrim grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
        {REAL_STATS.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </dl>
    </section>
  );
}

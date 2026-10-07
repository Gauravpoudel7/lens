import { Marquee } from "@/components/motion/marquee";
import { ECOSYSTEM } from "@/content/copy";

export function Ecosystem() {
  return (
    <section aria-labelledby="eco-title" className="mx-auto max-w-[1200px] px-4 pt-20 sm:px-6">
      <h2 id="eco-title" className="text-scrim mx-auto mb-8 w-fit text-center text-sm text-faint">
        {ECOSYSTEM.label}
      </h2>
      <Marquee label="data sources" speed={36} className="text-scrim">
        {ECOSYSTEM.names.map((name) => (
          <span
            key={name}
            className="mx-7 font-mono text-lg tracking-tight whitespace-nowrap text-white/55 transition-colors hover:text-white/80 md:mx-10 md:text-xl"
          >
            {name}
          </span>
        ))}
      </Marquee>
    </section>
  );
}

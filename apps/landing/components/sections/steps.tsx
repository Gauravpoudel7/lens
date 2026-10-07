"use client";

import { useRef } from "react";
import { m, useScroll, useSpring } from "framer-motion";
import { STEPS } from "@/content/copy";

// The four steps, joined by a line that draws as you scroll through them.
export function Steps() {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 60%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <ol ref={ref} className="text-scrim relative grid gap-10 md:grid-cols-4 md:gap-6">
      <div aria-hidden className="absolute top-5 bottom-5 left-5 w-px bg-white/10 md:top-5 md:right-[12.5%] md:bottom-auto md:left-[2.5rem] md:h-px md:w-auto" />
      <m.div
        aria-hidden
        style={{ scaleY: progress }}
        className="absolute top-5 bottom-5 left-5 w-px origin-top bg-gradient-to-b from-sol-violet to-sol-mint md:hidden"
      />
      <m.div
        aria-hidden
        style={{ scaleX: progress }}
        className="absolute top-5 right-[12.5%] left-[2.5rem] hidden h-px origin-left bg-gradient-to-r from-sol-violet to-sol-mint md:block"
      />
      {STEPS.map((step, i) => (
        <li key={step} className="relative flex items-center gap-5 md:flex-col md:items-start md:gap-6">
          <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-canvas font-mono text-sm text-ink">
            {i + 1}
          </span>
          <h3 className="text-lg font-semibold tracking-tight text-ink">{step}</h3>
        </li>
      ))}
    </ol>
  );
}

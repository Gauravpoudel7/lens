"use client";

import { useRef } from "react";
import { m, useReducedMotion, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

// Glass card with a cursor-following glow, a small lift on hover, and optional tilt (max 4deg).
export function GlowCard({
  children,
  className,
  tilt = false,
}: {
  children: React.ReactNode;
  className?: string;
  tilt?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useSpring(0, { stiffness: 300, damping: 24 });
  const ry = useSpring(0, { stiffness: 300, damping: 24 });

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    el.style.setProperty("--gx", `${px}px`);
    el.style.setProperty("--gy", `${py}px`);
    if (tilt && !reduce && e.pointerType === "mouse") {
      ry.set(((px / r.width) - 0.5) * 8);
      rx.set(-((py / r.height) - 0.5) * 8);
    }
  }
  function reset() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <m.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      style={tilt ? { rotateX: rx, rotateY: ry, transformPerspective: 900 } : undefined}
      className={cn(
        "group glass relative overflow-hidden rounded-2xl transition-colors duration-200 hover:border-white/20",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(420px circle at var(--gx, 50%) var(--gy, 50%), rgb(255 255 255 / 0.07), transparent 60%)",
        }}
      />
      <div className="relative h-full">{children}</div>
    </m.div>
  );
}

"use client";

import { useEffect, useState } from "react";

export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  className,
}: {
  value: number | null;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (value == null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const label = value == null ? "Not enough data" : `${value.toFixed(decimals)}${suffix}`;
  const text =
    value == null
      ? "—"
      : `${shown.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}${suffix}`;

  return (
    <span className={className} aria-label={label}>
      <span aria-hidden="true">{text}</span>
    </span>
  );
}

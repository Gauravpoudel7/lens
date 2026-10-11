"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

// CSS marquee: pauses on hover and focus, and with the button for keyboard users.
// Under prefers-reduced-motion the duplicate is hidden and the row is static (globals.css).
export function Marquee({
  children,
  speed = 40,
  reverse = false,
  label,
  className,
}: {
  children: React.ReactNode;
  speed?: number;
  reverse?: boolean;
  label: string;
  className?: string;
}) {
  const [paused, setPaused] = useState(false);
  return (
    <div className={cn("relative", className)}>
      <div
        className={cn("marquee overflow-hidden", reverse && "marquee-reverse")}
        data-paused={paused}
        style={{ ["--marquee-speed" as string]: `${speed}s` }}
      >
        <div className="marquee-track">
          <div className="flex shrink-0">{children}</div>
          <div className="flex shrink-0" aria-hidden data-motion-dup>
            {children}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        className="absolute -top-12 right-0 inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-faint opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 motion-reduce:hidden"
        aria-label={paused ? `Play ${label}` : `Pause ${label}`}
        aria-pressed={paused}
      >
        {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

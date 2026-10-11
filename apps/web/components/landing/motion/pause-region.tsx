"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

// Wraps auto-scrolling content with a visible pause control (motion that runs longer than 5s).
export function PauseRegion({ label, children }: { label: string; children: React.ReactNode }) {
  const [paused, setPaused] = useState(false);
  return (
    <div data-paused={paused}>
      <div className="mb-4 flex justify-end motion-reduce:hidden">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm text-faint transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          {paused ? `Play ${label}` : `Pause ${label}`}
        </button>
      </div>
      {children}
    </div>
  );
}

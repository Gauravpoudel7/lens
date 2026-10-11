"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className={cn(
          "relative inline-flex size-8 shrink-0 after:absolute after:-inset-1.5 after:content-[''] cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-white/[0.06] hover:text-ink",
          className,
        )}
      >
        {copied ? <Check className="size-3.5 text-low" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}

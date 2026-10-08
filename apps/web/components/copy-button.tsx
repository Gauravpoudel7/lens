"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ value, label = "Copy", icon = false }: { value: string; label?: string; icon?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (icon) {
    return (
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? "Copied" : label}
        className="inline-flex size-9 items-center justify-center rounded-full text-faint transition-colors hover:bg-panel-2 hover:text-ink"
      >
        {copied ? <Check className="size-4 text-low" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="rounded-md border border-line px-2.5 py-1 text-sm text-muted hover:text-ink"
    >
      <span className="sr-only">{label} </span>
      {copied ? "Copied" : label}
    </button>
  );
}

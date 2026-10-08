"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { PROOF_CLUSTER } from "@/lib/site";
import { cn } from "@/lib/utils";

// "Proof" chip that opens on hover, focus, or click to show the memo and signature.
export function ProofChip({ memo, signature, className }: { memo: string; signature: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn("text-xs", className)}
      onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-sol-mint/25 bg-sol-mint/[0.07] px-2.5 font-medium text-[#7cf7c4]"
      >
        <ShieldCheck className="size-3.5" aria-hidden />
        Proof written · {PROOF_CLUSTER}
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden" inert={!open}>
          <dl className="mt-2 space-y-1 rounded-lg border border-white/10 bg-black/40 p-2.5 font-mono text-[11px] text-body">
            <div className="flex items-center justify-between gap-2">
              <dt className="sr-only">Memo</dt>
              <dd className="truncate">{memo}</dd>
              <CopyButton value={memo} label="memo" />
            </div>
            <div className="flex items-center gap-2 text-faint">
              <dt>sig</dt>
              <dd className="truncate">{signature}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

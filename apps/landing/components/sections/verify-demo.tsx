"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROOF } from "@/content/copy";
import { sha256Hex } from "@/lib/proof";
import { cn } from "@/lib/utils";

// Client-only demo: hash the reply, keep the "on-chain" hash, then edit one character and compare.
export function VerifyDemo() {
  const [text, setText] = useState(PROOF.sample);
  const [chainHash, setChainHash] = useState("");
  const [hash, setHash] = useState("");

  useEffect(() => {
    sha256Hex(PROOF.sample).then(setChainHash);
  }, []);
  useEffect(() => {
    let live = true;
    sha256Hex(text).then((h) => live && setHash(h));
    return () => {
      live = false;
    };
  }, [text]);

  const edited = text !== PROOF.sample;
  const ok = hash !== "" && hash === chainHash;

  return (
    <div className="glass rounded-2xl p-5 md:p-6">
      <label htmlFor="verify-reply" className="text-xs text-faint">
        Reply as posted
      </label>
      <textarea
        id="verify-reply"
        readOnly
        value={text}
        rows={4}
        className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-[13px] leading-relaxed text-ink"
      />

      <dl className="mt-4 space-y-3 font-mono text-[12px]">
        <div>
          <dt className="text-faint">Memo on Solana</dt>
          <dd className="mt-1 break-all text-body">
            lens:v1|{PROOF.timestamp}|{chainHash || "…"}
          </dd>
        </div>
        <div>
          <dt className="text-faint">SHA-256 of the text above</dt>
          <dd className={cn("mt-1 break-all transition-colors duration-300", ok ? "text-[#7cf7c4]" : "text-[#fb7185]")}>
            {hash || "…"}
          </dd>
        </div>
      </dl>

      <p
        aria-live="polite"
        className={cn(
          "mt-5 flex items-start gap-2 rounded-xl border p-3 text-sm transition-colors duration-300",
          ok ? "border-low/30 bg-low/10 text-low" : "border-high/40 bg-high/10 text-[#fda4af]",
        )}
      >
        {ok ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        ) : (
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        )}
        {ok ? "Verified: text matches the on-chain hash." : "Verification failed: text does not match the on-chain hash."}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={edited}
          onClick={() => setText(PROOF.sample.replace("60%", "50%"))}
        >
          Edit one character
        </Button>
        <Button variant="ghost" size="sm" disabled={!edited} onClick={() => setText(PROOF.sample)}>
          <RotateCcw aria-hidden />
          Restore the original
        </Button>
      </div>
    </div>
  );
}

import { CopyButton } from "@/components/copy-button";
import { shortMint } from "@/lib/format";

export function MintLine({ mint }: { mint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-faint">Token mint</p>
          <p className="mt-1 font-mono text-2xl tracking-tight text-ink sm:text-3xl">{shortMint(mint)}</p>
        </div>
        <CopyButton value={mint} label="Copy mint" />
      </div>
      <p className="mt-2 break-all font-mono text-sm text-muted">{mint}</p>
      <p className="mt-2 text-sm text-faint">
        Match this address, not the ticker. A copy can use the same name and a different mint.
      </p>
    </div>
  );
}

import { CopyButton } from "@/components/copy-button";
import { shortMint } from "@/lib/format";

export function MintLine({ mint }: { mint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base text-faint">Token address (mint)</p>
          <p className="mt-1 font-mono text-2xl tracking-tight text-ink sm:text-3xl">{shortMint(mint)}</p>
        </div>
        <CopyButton value={mint} label="Copy address" />
      </div>
      <p className="mt-2 break-all font-mono text-sm text-muted">{mint}</p>
      <p className="mt-2 text-base text-faint">Match this address, not the ticker. Copies reuse names.</p>
    </div>
  );
}

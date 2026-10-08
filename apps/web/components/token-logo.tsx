"use client";

import { useState } from "react";

export function TokenLogo({
  mint,
  symbol,
  size = 56,
  fallback = true,
}: {
  mint: string;
  symbol: string;
  size?: number;
  /** When false, render nothing instead of the letter mark if no logo loads. */
  fallback?: boolean;
}) {
  const sources = mint
    ? [
        `https://static.jup.ag/tokens/${mint}`,
        `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${mint}/logo.png`,
      ]
    : [];
  const [index, setIndex] = useState(0);
  const letter = (symbol || "?").replace("$", "").slice(0, 1).toUpperCase();

  if (!sources[index]) {
    if (!fallback) return null;
    return (
      <div
        className="grid shrink-0 place-items-center rounded-full border border-line bg-panel-2 font-semibold text-ink"
        style={{ width: size, height: size, fontSize: size * 0.38 }}
      >
        {letter}
      </div>
    );
  }

  return (
    // Token logos come from public CDNs and fail closed to a letter mark.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[index]}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-line bg-panel-2 object-cover"
      onError={() => setIndex((current) => current + 1)}
      // An image that failed before hydration never fires onError, so check it once on mount.
      ref={(node) => {
        if (node?.complete && node.naturalWidth === 0) setIndex((current) => current + 1);
      }}
    />
  );
}

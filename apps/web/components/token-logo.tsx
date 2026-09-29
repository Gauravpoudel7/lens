"use client";

import { useState } from "react";

export function TokenLogo({ mint, symbol, size = 56 }: { mint: string; symbol: string; size?: number }) {
  const sources = mint
    ? [
        `https://static.jup.ag/tokens/${mint}`,
        `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${mint}/logo.png`,
      ]
    : [];
  const [index, setIndex] = useState(0);
  const letter = (symbol || "?").replace("$", "").slice(0, 1).toUpperCase();

  if (!sources[index]) {
    return (
      <div
        className="grid shrink-0 place-items-center rounded-full bg-white/10 font-semibold text-white"
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
      className="shrink-0 rounded-full bg-white/10 object-cover"
      onError={() => setIndex((current) => current + 1)}
    />
  );
}

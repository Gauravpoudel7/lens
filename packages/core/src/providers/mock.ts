import { createHash } from "node:crypto";
import { emptyLinks } from "../risk/engine.js";
import type { TokenSnapshot } from "../types.js";
import type { ResolvedSymbol, TokenDataProvider } from "./types.js";

export interface FixtureSpec {
  mint: string;
  symbol: string;
  name: string;
  ageHours: number;
  priceUsd: number;
  priceAfterWindow: number;
  liquidityUsd: number;
  lpLocked: boolean;
  top10HolderPct: number;
  creatorWallet: string;
  creatorSoldPct: number;
  creatorBalancePct: number;
  mintAuthorityActive: boolean;
  freezeAuthorityActive: boolean;
  sniperPct: number;
  burnedPct: number;
}

export const FIXTURES = {
  danger: {
    mint: "5bSUrQzzbSqGLzdcDtc4rpoy4AcGpxXLSZbzYb8FGgko",
    symbol: "DANGER",
    name: "Danger Token",
    ageHours: 3,
    priceUsd: 0.00012,
    priceAfterWindow: 0.00002,
    liquidityUsd: 4200,
    lpLocked: false,
    top10HolderPct: 82,
    creatorWallet: "6bzZwnSvBLur1xr9baRyHZ3Ck4GgiUCUZf8YQ3oXBEm5",
    creatorSoldPct: 60,
    creatorBalancePct: 8,
    mintAuthorityActive: true,
    freezeAuthorityActive: true,
    sniperPct: 45,
    burnedPct: 0,
  },
  safe: {
    mint: "6bzZwnSvBLur1xr9baRyHZ3Ck4GgiUCUZf8YQ3oXBEm5",
    symbol: "SAFE",
    name: "Safe Token",
    ageHours: 24 * 400,
    priceUsd: 1.25,
    priceAfterWindow: 1.62,
    liquidityUsd: 2_500_000,
    lpLocked: true,
    top10HolderPct: 22,
    creatorWallet: "6CdesJcNbTV5bJ1zVuRNmvbtVtgT3ccchyNT5MbKuKTM",
    creatorSoldPct: 0,
    creatorBalancePct: 4,
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    sniperPct: 2,
    burnedPct: 0,
  },
  mid: {
    mint: "6CdesJcNbTV5bJ1zVuRNmvbtVtgT3ccchyNT5MbKuKTM",
    symbol: "MID",
    name: "Mid Token",
    ageHours: 24 * 10,
    priceUsd: 0.42,
    priceAfterWindow: 0.4,
    liquidityUsd: 40_000,
    lpLocked: false,
    top10HolderPct: 55,
    creatorWallet: "5bSUrQzzbSqGLzdcDtc4rpoy4AcGpxXLSZbzYb8FGgko",
    creatorSoldPct: 0,
    creatorBalancePct: 6,
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    sniperPct: 8,
    burnedPct: 0,
  },
} as const satisfies Record<string, FixtureSpec>;

const BY_MINT = new Map<string, FixtureSpec>(Object.values(FIXTURES).map((spec) => [spec.mint, spec]));
const BY_SYMBOL = new Map<string, FixtureSpec>(
  Object.values(FIXTURES).map((spec) => [spec.symbol, spec]),
);

export function materializeFixture(spec: FixtureSpec, now = new Date()): TokenSnapshot {
  return {
    mint: spec.mint,
    symbol: spec.symbol,
    name: spec.name,
    decimals: 6,
    createdAt: new Date(now.getTime() - spec.ageHours * 3_600_000).toISOString(),
    priceUsd: spec.priceUsd,
    liquidityUsd: spec.liquidityUsd,
    lpLocked: spec.lpLocked,
    top10HolderPct: spec.top10HolderPct,
    creatorWallet: spec.creatorWallet,
    creatorSoldPct: spec.creatorSoldPct,
    creatorBalancePct: spec.creatorBalancePct,
    mintAuthorityActive: spec.mintAuthorityActive,
    freezeAuthorityActive: spec.freezeAuthorityActive,
    sniperPct: spec.sniperPct,
    burnedPct: spec.burnedPct,
    links: emptyLinks(spec.mint),
    sources: ["mock"],
  };
}

function syntheticSpec(mint: string): FixtureSpec {
  const bucket = createHash("sha256").update(mint).digest()[0] ?? 0;
  const base = bucket < 80 ? FIXTURES.danger : bucket < 170 ? FIXTURES.mid : FIXTURES.safe;
  return {
    ...base,
    mint,
    symbol: mint.slice(0, 4).toUpperCase(),
    name: "Synthetic mock token",
    creatorWallet: FIXTURES.safe.mint,
  };
}

export class MockTokenDataProvider implements TokenDataProvider {
  readonly name = "mock";
  private prices = new Map<string, number>();

  setPrice(mint: string, priceUsd: number): void {
    this.prices.set(mint, priceUsd);
  }

  async resolveBySymbol(symbol: string): Promise<{ mint: string; symbol: string; name: string } | null> {
    const spec = BY_SYMBOL.get(symbol.toUpperCase());
    if (!spec) return null;
    return { mint: spec.mint, symbol: spec.symbol, name: spec.name };
  }

  async getToken(mint: string): Promise<TokenSnapshot | null> {
    const spec = BY_MINT.get(mint) ?? syntheticSpec(mint);
    const snapshot = materializeFixture(spec);
    const override = this.prices.get(mint);
    if (override != null) snapshot.priceUsd = override;
    return snapshot;
  }

  async getPrice(mint: string): Promise<number | null> {
    if (this.prices.has(mint)) return this.prices.get(mint) ?? null;
    const spec = BY_MINT.get(mint);
    if (spec) return spec.priceUsd;
    return syntheticSpec(mint).priceUsd;
  }
}

export function fixtureBySymbol(symbol: string): FixtureSpec | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}

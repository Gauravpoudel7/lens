import { PublicKey } from "@solana/web3.js";
import { emptyLinks } from "../risk/engine.js";
import type { TokenSnapshot } from "../types.js";

const BURN_OWNERS = new Set([
  "1nc1nerator11111111111111111111111111111111",
  "11111111111111111111111111111111",
]);

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

export interface DexSummary {
  symbol: string;
  name: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  createdAt: string | null;
  url: string | null;
}

export interface ChainSummary {
  decimals: number;
  supply: bigint;
  mintAuthorityActive: boolean;
  mintAuthority?: string | null;
  freezeAuthorityActive: boolean;
  top10HolderPct: number | null;
  burnedPct: number | null;
}

export interface RugSummary {
  symbol: string | null;
  name: string | null;
  detectedAt: string | null;
  mintAuthorityActive: boolean | null;
  freezeAuthorityActive: boolean | null;
  top10HolderPct: number | null;
  burnedPct: number | null;
  creatorWallet: string | null;
  creatorBalancePct: number | null;
  sniperPct: number | null;
  lpLocked: boolean | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
}

export interface BirdeyeSummary {
  mintAuthorityActive: boolean | null;
  freezeAuthorityActive: boolean | null;
  top10HolderPct: number | null;
  creatorWallet: string | null;
  creatorBalancePct: number | null;
  creatorSoldPct: number | null;
  sniperPct: number | null;
  lpLocked: boolean | null;
}

export function parseMintAccount(data: Buffer): {
  supply: bigint;
  decimals: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
} | null {
  if (data.length < 82) return null;
  const mintAuthority =
    data.readUInt32LE(0) === 0 ? null : new PublicKey(data.subarray(4, 36)).toBase58();
  const supply = data.readBigUInt64LE(36);
  const decimals = data.readUInt8(44);
  const freezeAuthority =
    data.readUInt32LE(46) === 0 ? null : new PublicKey(data.subarray(50, 82)).toBase58();
  return { supply, decimals, mintAuthority, freezeAuthority };
}

export function holderStats(
  supply: bigint,
  accounts: Array<{ amount: bigint; owner: string | null }>,
): { top10HolderPct: number | null; burnedPct: number | null } {
  if (supply <= 0n) return { top10HolderPct: null, burnedPct: null };
  let burned = 0n;
  const holders: Array<{ amount: bigint }> = [];
  let ownersKnown = false;
  for (const account of accounts) {
    if (account.owner && BURN_OWNERS.has(account.owner)) {
      burned += account.amount;
      ownersKnown = true;
      continue;
    }
    if (account.owner) ownersKnown = true;
    holders.push(account);
  }
  holders.sort((a, b) => (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1));
  const top = holders.slice(0, 10).reduce((sum, account) => sum + account.amount, 0n);
  return {
    top10HolderPct: ratioPct(top, supply),
    burnedPct: ownersKnown ? ratioPct(burned, supply) : null,
  };
}

function ratioPct(part: bigint, whole: bigint): number {
  return Number((part * 10_000n) / whole) / 100;
}

export function parseDexTokenResponse(mint: string, body: unknown): DexSummary | null {
  const pairs = Array.isArray((body as { pairs?: unknown }).pairs)
    ? ((body as { pairs: unknown[] }).pairs as Array<Record<string, unknown>>)
    : [];
  const solana = pairs.filter((pair) => pair.chainId === "solana");
  const matched = solana.filter((pair) => {
    const base = pair.baseToken as { address?: string } | undefined;
    return base?.address === mint;
  });
  const usable = matched.length > 0 ? matched : solana;
  if (usable.length === 0) return null;
  const best = [...usable].sort((a, b) => liquidityOf(b) - liquidityOf(a))[0]!;
  const created = usable
    .map((pair) => (typeof pair.pairCreatedAt === "number" ? pair.pairCreatedAt : null))
    .filter((value): value is number => value != null);
  const base = best.baseToken as { symbol?: string; name?: string };
  return {
    symbol: base.symbol || "UNKNOWN",
    name: base.name || base.symbol || "Unknown token",
    priceUsd: numberOrNull(best.priceUsd),
    liquidityUsd: liquidityOf(best) || null,
    createdAt: created.length ? new Date(Math.min(...created)).toISOString() : null,
    url: typeof best.url === "string" ? best.url : null,
  };
}

function liquidityOf(pair: Record<string, unknown>): number {
  const liquidity = pair.liquidity as { usd?: number } | undefined;
  return typeof liquidity?.usd === "number" ? liquidity.usd : 0;
}

export function parseDexSearch(symbol: string, body: unknown): { mint: string; symbol: string; name: string } | null {
  const pairs = Array.isArray((body as { pairs?: unknown }).pairs)
    ? ((body as { pairs: unknown[] }).pairs as Array<Record<string, unknown>>)
    : [];
  const wanted = symbol.toUpperCase();
  const hits = pairs.filter((pair) => {
    if (pair.chainId !== "solana") return false;
    const base = pair.baseToken as { symbol?: string; address?: string } | undefined;
    return base?.symbol?.toUpperCase() === wanted && typeof base.address === "string";
  });
  if (hits.length === 0) return null;
  hits.sort((a, b) => liquidityOf(b) - liquidityOf(a));
  const base = hits[0]!.baseToken as { address: string; symbol: string; name?: string };
  return { mint: base.address, symbol: base.symbol, name: base.name || base.symbol };
}

export interface LpLockInput {
  liquidityUsd: number | null;
  lockersUsd: number;
  standardLpUsd: number;
  standardLockedUsd: number;
  clmmUsd: number;
}

export function interpretLpLock(input: LpLockInput): boolean | null {
  const lockedUsd = Math.max(input.lockersUsd, input.standardLockedUsd);
  const observed = input.standardLpUsd + input.clmmUsd;
  const total = Math.max(input.liquidityUsd ?? 0, observed);
  if (total <= 0 && lockedUsd <= 0) return null;
  if (total > 0 && lockedUsd / total >= 0.5) return true;
  if (input.standardLpUsd >= 1_000 && input.standardLockedUsd / input.standardLpUsd >= 0.8) return true;
  if (
    input.standardLpUsd >= 1_000 &&
    input.standardLockedUsd / input.standardLpUsd < 0.2 &&
    input.standardLpUsd >= input.clmmUsd
  ) {
    return false;
  }
  if (input.clmmUsd > input.standardLpUsd && (input.liquidityUsd ?? input.clmmUsd) >= 50_000) return null;
  if (input.standardLpUsd > 0 && lockedUsd === 0 && input.clmmUsd === 0) return false;
  return null;
}

export function parseRugcheckReport(body: unknown, now = new Date()): RugSummary | null {
  if (!body || typeof body !== "object") return null;
  const report = body as Record<string, unknown>;
  const token = (report.token ?? null) as Record<string, unknown> | null;
  const meta = (report.tokenMeta ?? null) as Record<string, unknown> | null;
  if (!token && !meta) return null;
  const supply = typeof token?.supply === "number" ? token.supply : null;
  const holders = Array.isArray(report.topHolders)
    ? (report.topHolders as Array<Record<string, unknown>>)
    : [];
  let top10HolderPct: number | null = null;
  let burnedPct: number | null = null;
  if (holders.length > 0) {
    const ranked = [...holders].sort((a, b) => numberOrZero(b.pct) - numberOrZero(a.pct));
    burnedPct = ranked
      .filter((holder) => typeof holder.owner === "string" && BURN_OWNERS.has(holder.owner))
      .reduce((sum, holder) => sum + numberOrZero(holder.pct), 0);
    top10HolderPct = ranked
      .filter((holder) => !(typeof holder.owner === "string" && BURN_OWNERS.has(holder.owner)))
      .slice(0, 10)
      .reduce((sum, holder) => sum + numberOrZero(holder.pct), 0);
  }
  const creatorBalance = typeof report.creatorBalance === "number" ? report.creatorBalance : null;
  return {
    symbol: typeof meta?.symbol === "string" ? meta.symbol : null,
    name: typeof meta?.name === "string" ? meta.name : null,
    detectedAt: typeof report.detectedAt === "string" ? report.detectedAt : null,
    mintAuthorityActive: token ? token.mintAuthority != null : null,
    freezeAuthorityActive: token ? token.freezeAuthority != null : null,
    top10HolderPct,
    burnedPct,
    creatorWallet: typeof report.creator === "string" ? report.creator : null,
    creatorBalancePct:
      supply && creatorBalance != null && supply > 0 ? (creatorBalance / supply) * 100 : null,
    sniperPct: rugSniperPct(report, supply),
    lpLocked: rugLpLocked(report, now),
    priceUsd: numberOrNull(report.price),
    liquidityUsd: numberOrNull(report.totalMarketLiquidity),
  };
}

function rugSniperPct(report: Record<string, unknown>, supply: number | null): number | null {
  const networks = Array.isArray(report.insiderNetworks)
    ? (report.insiderNetworks as Array<Record<string, unknown>>)
    : [];
  if (networks.length > 0 && supply && supply > 0) {
    const holding = networks.reduce((sum, network) => sum + numberOrZero(network.currentHolding), 0);
    const pct = (holding / supply) * 100;
    if (Number.isFinite(pct)) return Math.max(0, Math.min(100, pct));
  }
  if (report.graphInsidersDetected === 0) return 0;
  return null;
}

function rugLpLocked(report: Record<string, unknown>, now: Date): boolean | null {
  let lockersUsd = 0;
  if (report.lockers && typeof report.lockers === "object") {
    for (const value of Object.values(report.lockers as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const locker = value as Record<string, unknown>;
      if (typeof locker.unlockDate === "number" && locker.unlockDate * 1000 < now.getTime()) continue;
      lockersUsd += numberOrZero(locker.usdcLocked);
    }
  }
  let standardLpUsd = 0;
  let standardLockedUsd = 0;
  let clmmUsd = 0;
  const markets = Array.isArray(report.markets) ? (report.markets as Array<Record<string, unknown>>) : [];
  for (const market of markets) {
    const lp = market.lp as Record<string, unknown> | undefined;
    if (!lp) continue;
    const usd = numberOrZero(lp.baseUSD) + numberOrZero(lp.quoteUSD);
    const lpMint = typeof lp.lpMint === "string" ? lp.lpMint : "";
    if (lpMint && lpMint !== SYSTEM_PROGRAM) {
      standardLpUsd += usd;
      standardLockedUsd += usd * (numberOrZero(lp.lpLockedPct) / 100);
    } else {
      clmmUsd += usd;
    }
  }
  return interpretLpLock({
    liquidityUsd: numberOrNull(report.totalMarketLiquidity),
    lockersUsd,
    standardLpUsd,
    standardLockedUsd,
    clmmUsd,
  });
}

export function parseBirdeyeSecurity(body: unknown): BirdeyeSummary | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  if (Object.keys(data).length === 0) return null;
  const lockInfo = data.lockInfo as Record<string, unknown> | undefined;
  return {
    mintAuthorityActive: boolOrNull(data.mintable ?? data.isMintable),
    freezeAuthorityActive: boolOrNull(data.freezeable ?? data.freezeAuthority),
    top10HolderPct: numberOrNull(data.top10HolderPercent ?? data.top10HolderPct),
    creatorWallet: typeof data.creatorAddress === "string" ? data.creatorAddress : null,
    creatorBalancePct: numberOrNull(data.creatorPercentage),
    creatorSoldPct: numberOrNull(data.creatorSoldPercent ?? data.creatorSoldPct),
    sniperPct: numberOrNull(data.sniperPercentage ?? data.sniperPct),
    lpLocked: boolOrNull(lockInfo?.lock ?? data.lpLocked),
  };
}

export function mergeTokenData(input: {
  mint: string;
  dex: DexSummary | null;
  rug: RugSummary | null;
  chain: ChainSummary | null;
  birdeye: BirdeyeSummary | null;
}): TokenSnapshot | null {
  const { mint, dex, rug, chain, birdeye } = input;
  if (!dex && !rug && !chain) return null;
  const sources: string[] = [];
  if (dex) sources.push("dexscreener");
  if (chain) sources.push("solana-rpc");
  if (rug) sources.push("rugcheck");
  if (birdeye) sources.push("birdeye");
  const links = emptyLinks(mint);
  if (dex?.url) links.dexscreener = dex.url;
  const createdCandidates = [dex?.createdAt, rug?.detectedAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => !Number.isNaN(value));
  return {
    mint,
    symbol: dex?.symbol || rug?.symbol || "UNKNOWN",
    name: dex?.name || rug?.name || dex?.symbol || "Unknown token",
    decimals: chain?.decimals ?? 0,
    createdAt: createdCandidates.length ? new Date(Math.min(...createdCandidates)).toISOString() : null,
    priceUsd: dex?.priceUsd ?? rug?.priceUsd ?? null,
    liquidityUsd: dex?.liquidityUsd ?? rug?.liquidityUsd ?? null,
    lpLocked: birdeye?.lpLocked ?? rug?.lpLocked ?? null,
    top10HolderPct: chain?.top10HolderPct ?? birdeye?.top10HolderPct ?? rug?.top10HolderPct ?? null,
    creatorWallet: rug?.creatorWallet ?? birdeye?.creatorWallet ?? null,
    creatorSoldPct: birdeye?.creatorSoldPct ?? null,
    creatorBalancePct: rug?.creatorBalancePct ?? birdeye?.creatorBalancePct ?? null,
    mintAuthorityActive:
      chain?.mintAuthorityActive ?? birdeye?.mintAuthorityActive ?? rug?.mintAuthorityActive ?? null,
    mintAuthority: chain?.mintAuthority ?? null,
    freezeAuthorityActive:
      chain?.freezeAuthorityActive ?? birdeye?.freezeAuthorityActive ?? rug?.freezeAuthorityActive ?? null,
    sniperPct: birdeye?.sniperPct ?? rug?.sniperPct ?? null,
    burnedPct: chain?.burnedPct ?? rug?.burnedPct ?? null,
    links,
    sources,
  };
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0;
}

function boolOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length > 20) return true;
    if (value === "0" || value.toLowerCase() === "false") return false;
  }
  return null;
}

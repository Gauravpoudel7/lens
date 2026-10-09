import { PublicKey } from "@solana/web3.js";
import { emptyLinks } from "../risk/engine.js";
import type { TokenSnapshot } from "../types.js";

const BURN_OWNERS = new Set([
  "1nc1nerator11111111111111111111111111111111",
  "11111111111111111111111111111111",
]);

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

export const SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

/**
 * Top-10 holder share skips balances we can identify as a pool or bonding curve.
 * Two checks, and only those:
 * 1. The token-account authority is Raydium AMM v4's well-known authority.
 * 2. The account that owns that authority is a known AMM or pump.fun program
 *    (Raydium v4, Raydium CPMM, Orca Whirlpool, Meteora DLMM, Meteora pools,
 *    pump.fun, pump.fun AMM). The live reader fills `ownerProgram` from that
 *    account's program id. Owners we cannot identify stay in the top 10.
 */
export const RAYDIUM_AMM_AUTHORITY = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";

export const AMM_PROGRAM_IDS = new Set([
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
]);

export function isSplTokenProgram(owner: string | null | undefined): boolean {
  return owner === SPL_TOKEN_PROGRAM_ID || owner === TOKEN_2022_PROGRAM_ID;
}

export function isPoolHolder(owner: string | null | undefined, ownerProgram?: string | null): boolean {
  if (!owner) return false;
  if (owner === RAYDIUM_AMM_AUTHORITY) return true;
  return Boolean(ownerProgram && AMM_PROGRAM_IDS.has(ownerProgram));
}

export interface DexSummary {
  symbol: string;
  name: string;
  priceUsd: number | null;
  /** Sum of the pools that contain the mint and look real. Null when none do. */
  liquidityUsd: number | null;
  fdvUsd: number | null;
  createdAt: string | null;
  url: string | null;
  ignoredPools: Array<{ pair: string; reason: string }>;
}

export interface ChainSummary {
  decimals: number;
  supply: bigint;
  mintAuthorityActive: boolean;
  mintAuthority?: string | null;
  freezeAuthorityActive: boolean;
  top10HolderPct: number | null;
  burnedPct: number | null;
  permanentDelegate: boolean;
  transferFeeBps: number | null;
  transferHook: boolean;
  defaultFrozen: boolean;
  nonTransferable: boolean;
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
  permanentDelegate: boolean | null;
  transferFeeBps: number | null;
  transferFeeUnsized: boolean | null;
  transferHook: boolean | null;
  defaultFrozen: boolean | null;
  nonTransferable: boolean | null;
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

/** Token-2022 mint extensions start at byte 166 (165-byte base, then a 1-byte account type). */
const MINT_TLV_START = 166;
const EXT_TRANSFER_FEE_CONFIG = 1;
const EXT_DEFAULT_ACCOUNT_STATE = 6;
const EXT_NON_TRANSFERABLE = 9;
const EXT_PERMANENT_DELEGATE = 12;
const EXT_TRANSFER_HOOK = 14;

export interface MintExtensions {
  permanentDelegate: boolean;
  transferFeeBps: number | null;
  transferHook: boolean;
  defaultFrozen: boolean;
  nonTransferable: boolean;
}

export function parseMintExtensions(data: Buffer): MintExtensions {
  const found: MintExtensions = {
    permanentDelegate: false,
    transferFeeBps: null,
    transferHook: false,
    defaultFrozen: false,
    nonTransferable: false,
  };
  if (data.length <= MINT_TLV_START) return found;
  let offset = MINT_TLV_START;
  while (offset + 4 <= data.length) {
    const type = data.readUInt16LE(offset);
    const length = data.readUInt16LE(offset + 2);
    const start = offset + 4;
    if (length < 0 || start + length > data.length) break;
    const body = data.subarray(start, start + length);
    if (type === EXT_PERMANENT_DELEGATE && body.length >= 32) {
      const delegate = new PublicKey(body.subarray(0, 32)).toBase58();
      if (delegate !== SYSTEM_PROGRAM) found.permanentDelegate = true;
    } else if (type === EXT_TRANSFER_FEE_CONFIG && body.length >= 2) {
      found.transferFeeBps = body.readUInt16LE(body.length - 2);
    } else if (type === EXT_TRANSFER_HOOK && body.length >= 68) {
      const program = new PublicKey(body.subarray(36, 68)).toBase58();
      if (program !== SYSTEM_PROGRAM) found.transferHook = true;
    } else if (type === EXT_DEFAULT_ACCOUNT_STATE && body.length >= 1) {
      found.defaultFrozen = body[0] === 2;
    } else if (type === EXT_NON_TRANSFERABLE) {
      found.nonTransferable = true;
    }
    offset = start + length;
  }
  return found;
}

export function classifyMintAccount(
  value: { owner?: string | null; data?: [string, string] | null } | null | undefined,
):
  | { kind: "not_mint" }
  | { kind: "unavailable" }
  | {
      kind: "mint";
      parsed: NonNullable<ReturnType<typeof parseMintAccount>> & { extensions: MintExtensions };
    } {
  if (!value) return { kind: "not_mint" };
  if (!isSplTokenProgram(value.owner)) return { kind: "not_mint" };
  const raw = value.data?.[0];
  if (!raw) return { kind: "unavailable" };
  const bytes = Buffer.from(raw, "base64");
  const parsed = parseMintAccount(bytes);
  if (!parsed) return { kind: "not_mint" };
  return { kind: "mint", parsed: { ...parsed, extensions: parseMintExtensions(bytes) } };
}

export function holderStats(
  supply: bigint,
  accounts: Array<{ amount: bigint; owner: string | null; ownerProgram?: string | null }>,
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
    if (isPoolHolder(account.owner, account.ownerProgram)) {
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

/**
 * Solana DEX ids as DexScreener spells them. A pool on any other id is ignored.
 * ponytail: fixed allowlist. Add an id when the "dex pools ignored" log shows a real DEX.
 */
const KNOWN_DEX_IDS = new Set([
  "crema",
  "fluxbeam",
  "invariant",
  "launchlab",
  "lifinity",
  "meteora",
  "meteoradbc",
  "openbook",
  "orca",
  "pancakeswap",
  "phoenix",
  "pumpfun",
  "pumpswap",
  "raydium",
  "saber",
  "solfi",
  "stabble",
]);

/** A pool this deep with almost no trading is a reported number, not real depth. */
const FAKE_POOL_MIN_USD = 100_000;
const FAKE_POOL_MIN_VOLUME_RATIO = 0.001;
/** Solana mainnet beta launched 2020-03-16. An earlier pool time is a bad field. */
const SOLANA_GENESIS_MS = Date.parse("2020-03-16T00:00:00.000Z");

type DexPair = Record<string, unknown>;

/**
 * Only pools where the mint is the base or quote token count. Liquidity is the
 * sum of those pools after fake-looking ones are dropped. Price and FDV come
 * from the deepest kept pool where the mint is the base token.
 */
export function parseDexTokenResponse(mint: string, body: unknown): DexSummary | null {
  const pairs = Array.isArray((body as { pairs?: unknown }).pairs)
    ? ((body as { pairs: unknown[] }).pairs as DexPair[])
    : [];
  const withMint = pairs.filter(
    (pair) => pair.chainId === "solana" && (sideOf(pair, mint) === "base" || sideOf(pair, mint) === "quote"),
  );
  if (withMint.length === 0) return null;
  const ignoredPools: DexSummary["ignoredPools"] = [];
  const kept = withMint.filter((pair) => {
    const reason = fakePoolReason(pair, mint);
    if (reason) ignoredPools.push({ pair: pairLabel(pair), reason });
    return !reason;
  });
  const byDepth = (a: DexPair, b: DexPair) => liquidityOf(b) - liquidityOf(a);
  const best = kept.filter((pair) => sideOf(pair, mint) === "base").sort(byDepth)[0] ?? null;
  const shown = best ?? [...kept].sort(byDepth)[0] ?? withMint[0]!;
  const token = (sideOf(shown, mint) === "base" ? shown.baseToken : shown.quoteToken) as {
    symbol?: string;
    name?: string;
  };
  const total = kept.reduce((sum, pair) => sum + liquidityOf(pair), 0);
  const created = withMint
    .map((pair) => (typeof pair.pairCreatedAt === "number" ? pair.pairCreatedAt : null))
    .filter((value): value is number => value != null && value >= SOLANA_GENESIS_MS);
  return {
    symbol: token.symbol || "UNKNOWN",
    name: token.name || token.symbol || "Unknown token",
    priceUsd: best ? numberOrNull(best.priceUsd) : null,
    liquidityUsd: total > 0 ? total : null,
    fdvUsd: best ? (numberOrNull(best.fdv) ?? numberOrNull(best.marketCap)) : null,
    createdAt: created.length ? new Date(Math.min(...created)).toISOString() : null,
    url: typeof shown.url === "string" ? shown.url : null,
    ignoredPools,
  };
}

function sideOf(pair: DexPair, mint: string): "base" | "quote" | null {
  if ((pair.baseToken as { address?: string } | undefined)?.address === mint) return "base";
  if ((pair.quoteToken as { address?: string } | undefined)?.address === mint) return "quote";
  return null;
}

function fakePoolReason(pair: DexPair, mint: string): string | null {
  const dexId = typeof pair.dexId === "string" ? pair.dexId : "";
  if (!KNOWN_DEX_IDS.has(dexId)) return `unknown dex "${dexId || "none"}"`;
  const liquidity = liquidityOf(pair);
  const volume = numberOrZero((pair.volume as { h24?: unknown } | undefined)?.h24);
  if (liquidity >= FAKE_POOL_MIN_USD && volume < liquidity * FAKE_POOL_MIN_VOLUME_RATIO) {
    return "24h volume too low for its liquidity";
  }
  const fdv = numberOrNull(pair.fdv) ?? numberOrNull(pair.marketCap);
  if (sideOf(pair, mint) === "base" && fdv != null && fdv > 0 && liquidity > fdv) {
    return "liquidity above the token's FDV";
  }
  return null;
}

function pairLabel(pair: DexPair): string {
  return typeof pair.pairAddress === "string" ? pair.pairAddress : typeof pair.url === "string" ? pair.url : "unknown";
}

function liquidityOf(pair: DexPair): number {
  const liquidity = pair.liquidity as { usd?: number } | undefined;
  return typeof liquidity?.usd === "number" ? liquidity.usd : 0;
}

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** `$WIF` and `wif` are the same ticker. Jupiter stores dogwifhat as `$WIF`. */
export function normalizeTicker(symbol: string): string {
  return symbol.trim().replace(/^\$+/, "").toUpperCase();
}

export interface VerifiedTokenRow {
  mint: string;
  symbol: string;
  name: string;
}

/**
 * Rows from Jupiter `GET /tokens/v2/tag?query=verified`, or from a search payload.
 * A row counts only when `isVerified` is true or its tags include `verified`.
 * `moonshot-verified` alone is not enough. Reported liquidity is ignored.
 */
export function parseJupiterVerifiedTokens(body: unknown): VerifiedTokenRow[] {
  if (!Array.isArray(body)) return [];
  const seen = new Set<string>();
  const out: VerifiedTokenRow[] = [];
  for (const row of body) {
    if (!row || typeof row !== "object") continue;
    const token = row as Record<string, unknown>;
    if (!rowIsVerified(token)) continue;
    const mint = mintOf(token);
    const symbol = normalizeTicker(typeof token.symbol === "string" ? token.symbol : "");
    if (!mint || !symbol || seen.has(mint)) continue;
    seen.add(mint);
    const name = typeof token.name === "string" && token.name.trim() ? token.name.trim() : symbol;
    out.push({ mint, symbol, name });
  }
  return out;
}

export function indexVerifiedTokens(tokens: VerifiedTokenRow[]): Map<string, VerifiedTokenRow[]> {
  const bySymbol = new Map<string, VerifiedTokenRow[]>();
  for (const token of tokens) {
    const list = bySymbol.get(token.symbol);
    if (list) list.push(token);
    else bySymbol.set(token.symbol, [token]);
  }
  return bySymbol;
}

export function matchVerifiedSymbol(
  symbol: string,
  tokens: VerifiedTokenRow[],
): { status: "unique"; token: VerifiedTokenRow } | { status: "ambiguous"; count: number } | { status: "none" } {
  const wanted = normalizeTicker(symbol);
  const hits = tokens.filter((token) => token.symbol === wanted);
  if (hits.length === 1) return { status: "unique", token: hits[0]! };
  if (hits.length > 1) return { status: "ambiguous", count: hits.length };
  return { status: "none" };
}

function rowIsVerified(token: Record<string, unknown>): boolean {
  if (token.isVerified === false) return false;
  if (token.isVerified === true) return true;
  const tags = Array.isArray(token.tags) ? token.tags.filter((tag): tag is string => typeof tag === "string") : null;
  if (tags) return tags.includes("verified");
  return false;
}

function mintOf(token: Record<string, unknown>): string | null {
  const raw = typeof token.id === "string" ? token.id : typeof token.address === "string" ? token.address : "";
  return MINT_RE.test(raw) ? raw : null;
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
      .filter((holder) => {
        if (typeof holder.owner !== "string") return true;
        if (BURN_OWNERS.has(holder.owner)) return false;
        return !isPoolHolder(holder.owner);
      })
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
    ...rugTraps(report),
  };
}

function rugTraps(report: Record<string, unknown>): Pick<
  RugSummary,
  | "permanentDelegate"
  | "transferFeeBps"
  | "transferFeeUnsized"
  | "transferHook"
  | "defaultFrozen"
  | "nonTransferable"
> {
  const found = {
    permanentDelegate: null as boolean | null,
    transferFeeBps: null as number | null,
    transferFeeUnsized: null as boolean | null,
    transferHook: null as boolean | null,
    defaultFrozen: null as boolean | null,
    nonTransferable: null as boolean | null,
  };
  const risks = Array.isArray(report.risks) ? report.risks : [];
  for (const risk of risks) {
    if (!risk || typeof risk !== "object") continue;
    const row = risk as { name?: unknown; description?: unknown };
    const label = `${typeof row.name === "string" ? row.name : ""} ${typeof row.description === "string" ? row.description : ""}`.toLowerCase();
    if (/permanent delegate/.test(label)) found.permanentDelegate = true;
    if (/transfer hook/.test(label)) found.transferHook = true;
    if (/non-?transferable/.test(label)) found.nonTransferable = true;
    if (/default account state|frozen by default|accounts? start frozen/.test(label)) found.defaultFrozen = true;
    if (/transfer fee/.test(label)) {
      const match = label.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) {
        const bps = Math.round(Number(match[1]) * 100);
        if (Number.isFinite(bps)) found.transferFeeBps = bps;
      } else {
        found.transferFeeUnsized = true;
      }
    }
  }
  return found;
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
    // DexScreener pools only. RugCheck's total is a cross-check (see plausibleSnapshot), not a fallback.
    liquidityUsd: dex?.liquidityUsd ?? null,
    fdvUsd: dex?.fdvUsd ?? null,
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
    permanentDelegate: chain ? chain.permanentDelegate : (rug?.permanentDelegate ?? null),
    transferFeeBps: chain ? chain.transferFeeBps : (rug?.transferFeeBps ?? null),
    transferFeeUnsized: chain ? false : (rug?.transferFeeUnsized ?? null),
    transferHook: chain ? chain.transferHook : (rug?.transferHook ?? null),
    defaultFrozen: chain ? chain.defaultFrozen : (rug?.defaultFrozen ?? null),
    nonTransferable: chain ? chain.nonTransferable : (rug?.nonTransferable ?? null),
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

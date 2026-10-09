import { PublicKey } from "@solana/web3.js";
import { log, safeUrl } from "../ids.js";
import { rpcCall } from "../net/rpc.js";
import { withRetry } from "../net/retry.js";
import type { LensConfig, TokenSnapshot } from "../types.js";
import {
  classifyMintAccount,
  holderStats,
  indexVerifiedTokens,
  mergeTokenData,
  normalizeTicker,
  parseBirdeyeSecurity,
  parseDexTokenResponse,
  parseJupiterVerifiedTokens,
  parseRugcheckReport,
  type ChainSummary,
  type VerifiedTokenRow,
} from "./parse.js";
import { jupiterApiKeyHeader } from "./jupiter.js";
import type { SymbolMatch, TokenDataProvider } from "./types.js";

/** Refresh the verified symbol index at most this often. */
const VERIFIED_TTL_MS = 60 * 60 * 1000;
/** A short or empty payload is a failed read, not "no token is verified". */
const VERIFIED_MIN_COUNT = 100;

async function fetchJson(url: string, init?: RequestInit, attempts = 4, timeoutMs = 8_000): Promise<unknown> {
  return withRetry(
    safeUrl(url),
    async () => {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json", ...(init?.headers ?? {}) },
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} for ${safeUrl(url)}: ${body.slice(0, 180)}`);
      }
      return response.json();
    },
    { attempts, baseMs: 500 },
  );
}

export class LiveTokenDataProvider implements TokenDataProvider {
  readonly name = "live";
  private verified: { loadedAt: number; bySymbol: Map<string, VerifiedTokenRow[]> } | null = null;
  private verifiedInflight: Promise<Map<string, VerifiedTokenRow[]>> | null = null;

  constructor(
    private readonly config: Pick<LensConfig, "dataRpcUrl" | "birdeyeApiKey" | "jupiterBaseUrl"> & {
      jupiterApiKey?: string;
      rpcRetryAttempts?: number;
    },
  ) {}

  /**
   * Symbol lookup uses Jupiter's verified token list only.
   * DexScreener's search sorts by reported liquidity, and that number can be faked,
   * so it must not choose which mint a $ticker means.
   */
  async resolveBySymbol(symbol: string): Promise<SymbolMatch> {
    try {
      const index = await this.verifiedIndex();
      const hits = index.get(normalizeTicker(symbol)) ?? [];
      if (hits.length === 1) {
        const token = hits[0]!;
        return { status: "unique", token: { mint: token.mint, symbol: token.symbol, name: token.name } };
      }
      if (hits.length > 1) return { status: "ambiguous" };
      return { status: "none" };
    } catch (err) {
      log("verified symbol lookup failed", err instanceof Error ? err.message : err);
      return { status: "unavailable" };
    }
  }

  async getToken(mint: string): Promise<TokenSnapshot | null> {
    const [dex, rug, chainRead, birdeye] = await Promise.all([
      this.dex(mint),
      this.rug(mint),
      this.chain(mint),
      this.birdeye(mint),
    ]);
    if (chainRead.notMint) return null;
    const merged = mergeTokenData({ mint, dex, rug, chain: chainRead.summary, birdeye });
    if (!merged) return null;
    if (merged.priceUsd == null) {
      merged.priceUsd = await this.jupiterPrice(mint);
    }
    return merged;
  }

  async getPrice(mint: string): Promise<number | null> {
    const jupiter = await this.jupiterPrice(mint);
    if (jupiter != null) return jupiter;
    const dex = await this.dex(mint);
    return dex?.priceUsd ?? null;
  }

  private async dex(mint: string) {
    try {
      const body = await fetchJson(
        `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
        undefined,
        this.attempts(),
      );
      const summary = parseDexTokenResponse(mint, body);
      if (summary?.ignoredPools.length) {
        log("dex pools ignored", { mint, pools: summary.ignoredPools.slice(0, 5), count: summary.ignoredPools.length });
      }
      return summary;
    } catch (err) {
      log("DexScreener token failed", err instanceof Error ? err.message : err);
      return null;
    }
  }

  private async rug(mint: string) {
    try {
      const body = await fetchJson(
        `https://api.rugcheck.xyz/v1/tokens/${mint}/report`,
        undefined,
        this.attempts(),
      );
      return parseRugcheckReport(body);
    } catch (err) {
      log("RugCheck failed", err instanceof Error ? err.message : err);
      return null;
    }
  }

  private async birdeye(mint: string) {
    if (!this.config.birdeyeApiKey) return null;
    try {
      const body = await fetchJson(
        `https://public-api.birdeye.so/defi/token_security?address=${mint}`,
        {
          headers: {
            "X-API-KEY": this.config.birdeyeApiKey,
            "x-chain": "solana",
          },
        },
        this.attempts(),
      );
      return parseBirdeyeSecurity(body);
    } catch (err) {
      log("Birdeye security failed", err instanceof Error ? err.message : err);
      return null;
    }
  }

  private async jupiterPrice(mint: string): Promise<number | null> {
    try {
      const body = (await fetchJson(
        `${this.config.jupiterBaseUrl}/price/v3?ids=${mint}`,
        { headers: jupiterApiKeyHeader(this.config.jupiterApiKey) },
        this.attempts(),
      )) as Record<
        string,
        { usdPrice?: number }
      >;
      const price = body[mint]?.usdPrice;
      return typeof price === "number" ? price : null;
    } catch {
      return null;
    }
  }

  private async chain(mint: string): Promise<{ summary: ChainSummary | null; notMint: boolean }> {
    try {
      const account = await this.rpc("getAccountInfo", [mint, { encoding: "base64" }]);
      const value = (account as { value?: { owner?: string; data?: [string, string] } | null }).value ?? null;
      const classified = classifyMintAccount(value);
      if (classified.kind === "not_mint") return { summary: null, notMint: true };
      if (classified.kind !== "mint") return { summary: null, notMint: false };
      const parsed = classified.parsed;
      let top10HolderPct: number | null = null;
      let burnedPct: number | null = null;
      try {
        const largest = await this.rpc("getTokenLargestAccounts", [mint]);
        const rows =
          ((largest as { value?: Array<{ address: string; amount: string }> }).value ?? []);
        const owners = await this.owners(rows.map((row) => row.address));
        const stats = holderStats(
          parsed.supply,
          rows.map((row) => {
            const holder = owners.get(row.address);
            return {
              amount: BigInt(row.amount),
              owner: holder?.owner ?? null,
              ownerProgram: holder?.ownerProgram ?? null,
            };
          }),
        );
        top10HolderPct = stats.top10HolderPct;
        burnedPct = stats.burnedPct;
      } catch (err) {
        log("holder accounts unavailable", err instanceof Error ? err.message : err);
      }
      return {
        notMint: false,
        summary: {
          decimals: parsed.decimals,
          supply: parsed.supply,
          mintAuthorityActive: parsed.mintAuthority != null,
          mintAuthority: parsed.mintAuthority,
          freezeAuthorityActive: parsed.freezeAuthority != null,
          top10HolderPct,
          burnedPct,
          permanentDelegate: parsed.extensions.permanentDelegate,
          transferFeeBps: parsed.extensions.transferFeeBps,
          transferHook: parsed.extensions.transferHook,
          defaultFrozen: parsed.extensions.defaultFrozen,
          nonTransferable: parsed.extensions.nonTransferable,
        },
      };
    } catch (err) {
      log("Solana RPC token read failed", err instanceof Error ? err.message : err);
      return { summary: null, notMint: false };
    }
  }

  private async owners(
    addresses: string[],
  ): Promise<Map<string, { owner: string | null; ownerProgram: string | null }>> {
    const result = new Map<string, { owner: string | null; ownerProgram: string | null }>();
    if (addresses.length === 0) return result;
    const body = await this.rpc("getMultipleAccounts", [addresses, { encoding: "base64" }]);
    const values =
      (body as { value?: Array<{ owner?: string; data?: [string, string] } | null> }).value ?? [];
    addresses.forEach((address, index) => {
      const encoded = values[index]?.data?.[0];
      if (!encoded) {
        result.set(address, { owner: null, ownerProgram: null });
        return;
      }
      const data = Buffer.from(encoded, "base64");
      if (data.length < 64) {
        result.set(address, { owner: null, ownerProgram: null });
        return;
      }
      result.set(address, { owner: new PublicKey(data.subarray(32, 64)).toBase58(), ownerProgram: null });
    });
    const authorities = [...new Set([...result.values()].map((row) => row.owner).filter((owner): owner is string => Boolean(owner)))];
    if (authorities.length === 0) return result;
    try {
      const programs = await this.rpc("getMultipleAccounts", [authorities, { encoding: "base64" }]);
      const programValues = (programs as { value?: Array<{ owner?: string } | null> }).value ?? [];
      const programByAuthority = new Map<string, string>();
      authorities.forEach((authority, index) => {
        const owner = programValues[index]?.owner;
        if (owner) programByAuthority.set(authority, owner);
      });
      for (const [address, row] of result) {
        if (!row.owner) continue;
        result.set(address, { ...row, ownerProgram: programByAuthority.get(row.owner) ?? null });
      }
    } catch (err) {
      log("holder program lookup failed", err instanceof Error ? err.message : err);
    }
    return result;
  }

  private attempts(): number {
    return this.config.rpcRetryAttempts ?? 4;
  }

  private verifiedIndex(): Promise<Map<string, VerifiedTokenRow[]>> {
    const fresh = this.verified && Date.now() - this.verified.loadedAt < VERIFIED_TTL_MS;
    if (fresh && this.verified) return Promise.resolve(this.verified.bySymbol);
    if (!this.verifiedInflight) {
      this.verifiedInflight = this.loadVerifiedIndex().finally(() => {
        this.verifiedInflight = null;
      });
    }
    return this.verifiedInflight;
  }

  private async loadVerifiedIndex(): Promise<Map<string, VerifiedTokenRow[]>> {
    try {
      const body = await fetchJson(
        `${this.config.jupiterBaseUrl}/tokens/v2/tag?query=verified`,
        { headers: jupiterApiKeyHeader(this.config.jupiterApiKey) },
        2,
        20_000,
      );
      const tokens = parseJupiterVerifiedTokens(body);
      if (tokens.length < VERIFIED_MIN_COUNT) {
        throw new Error(`jupiter verified list too small (${tokens.length})`);
      }
      const bySymbol = indexVerifiedTokens(tokens);
      this.verified = { loadedAt: Date.now(), bySymbol };
      log("jupiter verified list loaded", { count: tokens.length });
      return bySymbol;
    } catch (err) {
      log("jupiter verified list failed", err instanceof Error ? err.message : err);
      if (this.verified) return this.verified.bySymbol;
      throw err;
    }
  }

  private rpc(method: string, params: unknown[]): Promise<unknown> {
    return rpcCall(this.config.dataRpcUrl, method, params, { attempts: this.attempts() });
  }
}

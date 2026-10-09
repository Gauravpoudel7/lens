import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  AMM_PROGRAM_IDS,
  RAYDIUM_AMM_AUTHORITY,
  SPL_TOKEN_PROGRAM_ID,
  classifyMintAccount,
  holderStats,
  interpretLpLock,
  matchVerifiedSymbol,
  parseDexTokenResponse,
  parseJupiterVerifiedTokens,
  parseMintAccount,
  parseMintExtensions,
  mergeTokenData,
  parseRugcheckReport,
} from "./parse.js";
import { evaluateRisk, snapshotToRuleInput } from "../risk/engine.js";
import { buildTemplateReply } from "../reply/policy.js";

describe("live data parsers", () => {
  it("reads mint and freeze authority from an SPL mint account", () => {
    const mintAuthority = Keypair.generate().publicKey;
    const data = Buffer.alloc(82);
    data.writeUInt32LE(1, 0);
    data.set(mintAuthority.toBytes(), 4);
    data.writeBigUInt64LE(1_000_000n, 36);
    data.writeUInt8(6, 44);
    data.writeUInt8(1, 45);
    data.writeUInt32LE(0, 46);
    const parsed = parseMintAccount(data);
    expect(parsed?.mintAuthority).toBe(mintAuthority.toBase58());
    expect(parsed?.freezeAuthority).toBeNull();
    expect(parsed?.supply).toBe(1_000_000n);
    expect(parsed?.decimals).toBe(6);
  });

  it("excludes the incinerator from the top 10 and counts it as burned", () => {
    const stats = holderStats(1000n, [
      { amount: 400n, owner: "1nc1nerator11111111111111111111111111111111" },
      { amount: 200n, owner: new PublicKey(Buffer.alloc(32, 2)).toBase58() },
      { amount: 50n, owner: new PublicKey(Buffer.alloc(32, 3)).toBase58() },
    ]);
    expect(stats.burnedPct).toBe(40);
    expect(stats.top10HolderPct).toBe(25);
  });

  it("leaves pool vaults and bonding-curve accounts out of the top 10", () => {
    const [pump] = [...AMM_PROGRAM_IDS].filter((id) => id.startsWith("6EF8"));
    const stats = holderStats(1000n, [
      { amount: 700n, owner: RAYDIUM_AMM_AUTHORITY },
      { amount: 200n, owner: "curve-authority", ownerProgram: pump },
      { amount: 100n, owner: new PublicKey(Buffer.alloc(32, 4)).toBase58() },
    ]);
    expect(stats.top10HolderPct).toBe(10);
  });

  it("reads Token-2022 traps from mint extension bytes", () => {
    const delegate = Keypair.generate().publicKey;
    const hook = Keypair.generate().publicKey;
    const data = Buffer.alloc(166 + 4 + 32 + 4 + 116 + 4 + 68 + 4 + 1 + 4);
    data[165] = 1;
    let offset = 166;
    const write = (type: number, body: Buffer) => {
      data.writeUInt16LE(type, offset);
      data.writeUInt16LE(body.length, offset + 2);
      body.copy(data, offset + 4);
      offset += 4 + body.length;
    };
    write(12, Buffer.from(delegate.toBytes()));
    const fee = Buffer.alloc(116);
    fee.writeUInt16LE(800, 114);
    write(1, fee);
    const hookBody = Buffer.alloc(68);
    hookBody.set(hook.toBytes(), 36);
    write(14, hookBody);
    write(6, Buffer.from([2]));
    write(9, Buffer.alloc(0));
    const extensions = parseMintExtensions(data.subarray(0, offset));
    expect(extensions.permanentDelegate).toBe(true);
    expect(extensions.transferFeeBps).toBe(800);
    expect(extensions.transferHook).toBe(true);
    expect(extensions.defaultFrozen).toBe(true);
    expect(extensions.nonTransferable).toBe(true);
  });

  it("rejects an account that is not owned by a token program", () => {
    const data = Buffer.alloc(82);
    data.writeUInt32LE(0, 0);
    data.writeBigUInt64LE(1n, 36);
    data.writeUInt32LE(0, 46);
    const encoded = data.toString("base64");
    expect(classifyMintAccount({ owner: "11111111111111111111111111111111", data: [encoded, "base64"] }).kind).toBe(
      "not_mint",
    );
    expect(classifyMintAccount(null).kind).toBe("not_mint");
    expect(classifyMintAccount({ owner: SPL_TOKEN_PROGRAM_ID, data: [encoded, "base64"] }).kind).toBe("mint");
  });

  it("sums the mint's Solana pools, prices from the deepest, and takes the earliest pool time", () => {
    const summary = parseDexTokenResponse("Mint111", {
      pairs: [
        {
          chainId: "solana",
          dexId: "raydium",
          url: "https://dexscreener.com/solana/new",
          baseToken: { address: "Mint111", symbol: "NEW", name: "New" },
          priceUsd: "0.2",
          liquidity: { usd: 50 },
          pairCreatedAt: 1_700_000_000_000,
        },
        {
          chainId: "solana",
          dexId: "orca",
          url: "https://dexscreener.com/solana/deep",
          baseToken: { address: "Mint111", symbol: "NEW", name: "New" },
          priceUsd: "0.25",
          liquidity: { usd: 9_000 },
          pairCreatedAt: 1_800_000_000_000,
        },
        { chainId: "ethereum", baseToken: { address: "nope", symbol: "NO" } },
      ],
    });
    expect(summary?.priceUsd).toBe(0.25);
    expect(summary?.liquidityUsd).toBe(9050);
    expect(summary?.createdAt).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it("does not post a fake $900M pool that sits next to the real pools", () => {
    const jup = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
    const token = { address: jup, symbol: "JUP", name: "Jupiter" };
    const sol = { address: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Wrapped SOL" };
    const dex = parseDexTokenResponse(jup, {
      pairs: [
        {
          chainId: "solana",
          dexId: "meteora",
          pairAddress: "FakePool",
          baseToken: token,
          quoteToken: sol,
          priceUsd: "1656.9",
          liquidity: { usd: 900_000_000 },
          volume: { h24: 1_200 },
          fdv: 11_000_000_000,
          pairCreatedAt: Date.parse("2025-10-25T00:00:00Z"),
        },
        {
          chainId: "solana",
          dexId: "meteora",
          pairAddress: "RealPool",
          baseToken: token,
          quoteToken: sol,
          priceUsd: "0.3625",
          liquidity: { usd: 2_000_000 },
          volume: { h24: 5_800_000 },
          fdv: 2_500_000_000,
          pairCreatedAt: Date.parse("2024-01-31T00:00:00Z"),
        },
        {
          chainId: "solana",
          dexId: "orca",
          pairAddress: "SecondPool",
          baseToken: token,
          quoteToken: sol,
          priceUsd: "0.3624",
          liquidity: { usd: 300_000 },
          volume: { h24: 600_000 },
          fdv: 2_500_000_000,
          pairCreatedAt: Date.parse("2024-01-29T00:00:00Z"),
        },
      ],
    });
    expect(dex?.ignoredPools).toEqual([{ pair: "FakePool", reason: "24h volume too low for its liquidity" }]);
    expect(dex?.liquidityUsd).toBe(2_300_000);
    expect(dex?.priceUsd).toBe(0.3625);
    const snapshot = mergeTokenData({ mint: jup, dex, rug: null, chain: null, birdeye: null })!;
    const now = new Date("2026-10-08T00:00:00Z");
    const report = evaluateRisk(snapshotToRuleInput(snapshot, { burned: false, locked: false }, now), snapshot.links);
    const reply = buildTemplateReply({
      riskLevel: report.level,
      symbol: snapshot.symbol,
      name: snapshot.name,
      mint: jup,
      facts: report.facts,
      reportUrl: "https://example.com/r/x",
    });
    expect(reply).not.toContain("900M");
    expect(reply).not.toContain("$900");
    expect(reply).toContain("Liquidity is $2.3M");
  });

  it("never uses pools that do not contain the mint", () => {
    const summary = parseDexTokenResponse("Mint111", {
      pairs: [
        {
          chainId: "solana",
          dexId: "raydium",
          baseToken: { address: "Other111", symbol: "OTH" },
          quoteToken: { address: "So11111111111111111111111111111111111111112", symbol: "SOL" },
          liquidity: { usd: 5_000_000 },
          volume: { h24: 9_000_000 },
          pairCreatedAt: 1_600_000_000_000,
        },
      ],
    });
    expect(summary).toBeNull();
    const merged = mergeTokenData({
      mint: "Mint111",
      dex: summary,
      rug: { ...emptyRug(), liquidityUsd: 2_500_000_000 },
      chain: null,
      birdeye: null,
    });
    expect(merged?.liquidityUsd).toBeNull();
    expect(merged?.createdAt).toBeNull();
  });

  it("counts a pool where the mint is the quote token, but takes no price from it", () => {
    const summary = parseDexTokenResponse("Mint111", {
      pairs: [
        {
          chainId: "solana",
          dexId: "meteora",
          baseToken: { address: "Other111", symbol: "MET", name: "Meteora" },
          quoteToken: { address: "Mint111", symbol: "JUP", name: "Jupiter" },
          priceUsd: "0.42",
          liquidity: { usd: 214_000 },
          volume: { h24: 25_000_000 },
          pairCreatedAt: 1_761_396_180_000,
        },
      ],
    });
    expect(summary).toMatchObject({ symbol: "JUP", name: "Jupiter", liquidityUsd: 214_000, priceUsd: null, fdvUsd: null });
  });

  it("ignores pools on an unknown DEX and pools deeper than the token's FDV", () => {
    const base = { address: "Mint111", symbol: "NEW", name: "New" };
    const summary = parseDexTokenResponse("Mint111", {
      pairs: [
        { chainId: "solana", dexId: "mysteryswap", pairAddress: "A", baseToken: base, liquidity: { usd: 5_000 }, volume: { h24: 9_000 } },
        { chainId: "solana", dexId: "raydium", pairAddress: "B", baseToken: base, liquidity: { usd: 50_000 }, volume: { h24: 9_000 }, fdv: 40_000 },
        { chainId: "solana", dexId: "raydium", pairAddress: "C", baseToken: base, liquidity: { usd: 20_000 }, volume: { h24: 9_000 }, fdv: 90_000 },
      ],
    });
    expect(summary?.liquidityUsd).toBe(20_000);
    expect(summary?.ignoredPools.map((pool) => pool.pair)).toEqual(["A", "B"]);
  });

  it("keeps one verified ticker and drops a higher-liquidity copycat", () => {
    const real = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
    const copy = "JUPrJXKV6MyLkbFgZMDXPn7mYR4yqMNn5Pwg27zcyyG";
    const tokens = parseJupiterVerifiedTokens([
      {
        id: copy,
        symbol: "JUP",
        name: "JUP",
        isVerified: false,
        tags: ["unknown"],
        liquidity: 40_462_994,
      },
      {
        id: real,
        symbol: "JUP",
        name: "Jupiter",
        isVerified: true,
        tags: ["verified", "strict"],
        liquidity: 2_169_290,
      },
      {
        id: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
        symbol: "$WIF",
        name: "dogwifhat",
        isVerified: true,
        tags: ["verified"],
      },
      {
        id: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        symbol: "BABY",
        name: "Baby One",
        tags: ["verified"],
      },
      {
        id: "6bzZwnSvBLur1xr9baRyHZ3Ck4GgiUCUZf8YQ3oXBEm5",
        symbol: "BABY",
        name: "Baby Two",
        isVerified: true,
      },
      {
        id: "5bSUrQzzbSqGLzdcDtc4rpoy4AcGpxXLSZbzYb8FGgko",
        symbol: "MOON",
        name: "Moonshot only",
        tags: ["moonshot-verified"],
      },
    ]);
    expect(matchVerifiedSymbol("jup", tokens)).toEqual({
      status: "unique",
      token: { mint: real, symbol: "JUP", name: "Jupiter" },
    });
    expect(tokens.some((token) => token.mint === copy)).toBe(false);
    expect(matchVerifiedSymbol("WIF", tokens)).toMatchObject({
      status: "unique",
      token: { symbol: "WIF", name: "dogwifhat" },
    });
    expect(matchVerifiedSymbol("BABY", tokens)).toEqual({ status: "ambiguous", count: 2 });
    expect(matchVerifiedSymbol("MOON", tokens)).toEqual({ status: "none" });
    expect(matchVerifiedSymbol("XRP", tokens)).toEqual({ status: "none" });
  });

  it("reads lock status from classic LP pools and leaves concentrated liquidity unknown", () => {
    expect(
      interpretLpLock({
        liquidityUsd: 20_000,
        lockersUsd: 0,
        standardLpUsd: 20_000,
        standardLockedUsd: 18_000,
        clmmUsd: 0,
      }),
    ).toBe(true);
    expect(
      interpretLpLock({
        liquidityUsd: 20_000,
        lockersUsd: 0,
        standardLpUsd: 20_000,
        standardLockedUsd: 0,
        clmmUsd: 0,
      }),
    ).toBe(false);
    expect(
      interpretLpLock({
        liquidityUsd: 2_000_000,
        lockersUsd: 0,
        standardLpUsd: 0,
        standardLockedUsd: 0,
        clmmUsd: 2_000_000,
      }),
    ).toBeNull();
  });

  it("maps a rugcheck-style report without throwing", () => {
    const summary = parseRugcheckReport({
      creator: "Creator111",
      creatorBalance: 100,
      detectedAt: "2024-01-01T00:00:00.000Z",
      token: { mintAuthority: null, freezeAuthority: null, supply: 1000, decimals: 6 },
      tokenMeta: { name: "Coin", symbol: "COIN" },
      topHolders: [{ owner: "WalletA", pct: 10 }],
      graphInsidersDetected: 0,
      insiderNetworks: [],
      markets: [],
      totalMarketLiquidity: 0,
      lockers: {},
    });
    expect(summary?.mintAuthorityActive).toBe(false);
    expect(summary?.freezeAuthorityActive).toBe(false);
    expect(summary?.sniperPct).toBe(0);
    expect(summary?.symbol).toBe("COIN");
  });

  it("reads Token-2022 risks from a RugCheck report", () => {
    const summary = parseRugcheckReport({
      token: { mintAuthority: null, freezeAuthority: null, supply: 1000 },
      tokenMeta: { symbol: "FEE", name: "Fee" },
      risks: [
        { name: "Permanent Delegate", description: "A delegate can move tokens" },
        { name: "Transfer Fee", description: "Transfer fee of 8%" },
      ],
    });
    expect(summary?.permanentDelegate).toBe(true);
    expect(summary?.transferFeeBps).toBe(800);
  });
});

function emptyRug() {
  return {
    symbol: null,
    name: null,
    detectedAt: null,
    mintAuthorityActive: null,
    freezeAuthorityActive: null,
    top10HolderPct: null,
    burnedPct: null,
    creatorWallet: null,
    creatorBalancePct: null,
    sniperPct: null,
    lpLocked: null,
    priceUsd: null,
    liquidityUsd: null,
    permanentDelegate: null,
    transferFeeBps: null,
    transferFeeUnsized: null,
    transferHook: null,
    defaultFrozen: null,
    nonTransferable: null,
  };
}

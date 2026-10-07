import { describe, expect, it } from "vitest";
import { FIXTURES, MockTokenDataProvider } from "./providers/mock.js";
import type { SymbolMatch, TokenDataProvider } from "./providers/types.js";
import { extractTokenCandidates, resolveToken } from "./resolver.js";

const REAL_JUP = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const COPY_JUP = "JUPrJXKV6MyLkbFgZMDXPn7mYR4yqMNn5Pwg27zcyyG";

function scripted(matches: Record<string, SymbolMatch>, calls: string[] = []): TokenDataProvider {
  return {
    name: "scripted",
    async resolveBySymbol(symbol) {
      calls.push(symbol);
      return matches[symbol.toUpperCase()] ?? { status: "none" };
    },
    async getToken() {
      return null;
    },
    async getPrice() {
      return null;
    },
  };
}

describe("token resolver", () => {
  it("pulls a mint and a ticker out of a post", () => {
    const text = `Just aped $DANGER. CA: ${FIXTURES.danger.mint} LP locked and burned`;
    const found = extractTokenCandidates(text);
    expect(found.mints).toEqual([FIXTURES.danger.mint]);
    expect(found.symbols).toEqual(["DANGER"]);
  });

  it("prefers the contract address over the ticker", async () => {
    const provider = new MockTokenDataProvider();
    const resolved = await resolveToken(
      `$SAFE but the coin is ${FIXTURES.danger.mint}`,
      provider,
    );
    expect(resolved).toMatchObject({ status: "token", mint: FIXTURES.danger.mint, via: "mint" });
  });

  it("resolves a verified ticker when no address is present", async () => {
    const provider = new MockTokenDataProvider();
    const resolved = await resolveToken("@askLens is this legit? $safe", provider);
    expect(resolved).toMatchObject({
      status: "token",
      mint: FIXTURES.safe.mint,
      symbol: "SAFE",
      via: "symbol",
    });
  });

  it("resolves a verified $JUP and does not take a copycat", async () => {
    const resolved = await resolveToken(
      "@justasklens is $JUP safe?",
      scripted({
        JUP: { status: "unique", token: { mint: REAL_JUP, symbol: "JUP", name: "Jupiter" } },
      }),
    );
    expect(resolved).toMatchObject({ status: "token", mint: REAL_JUP, symbol: "JUP", via: "symbol" });
  });

  it("refuses a ticker when no single verified token matches", async () => {
    for (const match of [{ status: "none" } as const, { status: "ambiguous" } as const]) {
      const resolved = await resolveToken("@justasklens is $JUP safe?", scripted({ JUP: match }));
      expect(resolved?.status).toBe("notice");
      if (resolved?.status !== "notice") return;
      expect(resolved.text).toContain("Several coins use $JUP");
      expect(resolved.text).toContain("contract address");
      expect(resolved.text).not.toContain(COPY_JUP);
      expect(resolved.text.endsWith("Not financial advice.")).toBe(true);
    }
  });

  it("scores the contract address exactly, even when the ticker is $JUP", async () => {
    const calls: string[] = [];
    const resolved = await resolveToken(
      `@justasklens check ${COPY_JUP} $JUP`,
      scripted(
        { JUP: { status: "unique", token: { mint: REAL_JUP, symbol: "JUP", name: "Jupiter" } } },
        calls,
      ),
    );
    expect(resolved).toMatchObject({ status: "token", mint: COPY_JUP, via: "mint" });
    expect(calls).toEqual([]);
  });

  it("does not score a non-Solana major from a bare ticker", async () => {
    const calls: string[] = [];
    const resolved = await resolveToken(
      "@justasklens is $XRP safe?",
      scripted(
        { XRP: { status: "unique", token: { mint: COPY_JUP, symbol: "XRP", name: "XRP" } } },
        calls,
      ),
    );
    expect(calls).toEqual([]);
    expect(resolved?.status).toBe("notice");
    if (resolved?.status !== "notice") return;
    expect(resolved.text).toContain("$XRP isn't a Solana-native token");
    expect(resolved.text).not.toMatch(/\b(LOW|MEDIUM|HIGH)\b/);
    expect(resolved.text.endsWith("Not financial advice.")).toBe(true);
  });

  it("does not score $SOL, $USDC, or $USDT as meme-coin risk", async () => {
    const sol = await resolveToken("$SOL", scripted({}));
    expect(sol?.status).toBe("notice");
    if (sol?.status === "notice") expect(sol.text).toContain("native Solana asset");

    const usdc = await resolveToken("is $USDC safe?", scripted({}));
    expect(usdc?.status).toBe("notice");
    if (usdc?.status === "notice") {
      expect(usdc.text).toContain("EPjF…Dt1v");
      expect(usdc.text).toContain("stablecoin");
      expect(usdc.text).not.toMatch(/\b(LOW|MEDIUM|HIGH)\b/);
    }

    const usdt = await resolveToken("$USDT", scripted({}));
    expect(usdt?.status).toBe("notice");
    if (usdt?.status === "notice") expect(usdt.text).toContain("Es9v…wNYB");
  });

  it("asks for a contract when the verified list cannot be loaded", async () => {
    const resolved = await resolveToken("$BONK", scripted({ BONK: { status: "unavailable" } }));
    expect(resolved?.status).toBe("notice");
    if (resolved?.status !== "notice") return;
    expect(resolved.text).toContain("couldn't confirm a verified $BONK");
    expect(resolved.text).not.toContain("Several coins");
    expect(resolved.text.endsWith("Not financial advice.")).toBe(true);
  });

  it("ignores program ids and questions that have no token", async () => {
    const provider = new MockTokenDataProvider();
    const found = extractTokenCandidates(
      "Token program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA and memo MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    );
    expect(found.mints).toEqual([]);
    expect(await resolveToken("@askLens is this legit?", provider)).toBeNull();
  });
});

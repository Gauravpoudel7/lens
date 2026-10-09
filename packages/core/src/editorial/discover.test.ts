import { describe, expect, it, vi } from "vitest";
import { listTrendingSolana, parseTrendingPools, TRENDING_URL } from "./discover.js";

const MEME = "HbPDWSqu8hpVMX6gMjwMDGe5rVgicWo3Qh3Jaojypump";
const OTHER = "GTBxUiw6wJdmmkCGZgRHLyYxqu1vG4KtRpeox6yDpump";
const XRP_COPY = "69vXQQScU6Ra2mQ3p95JXmSq8LHjUbdAWvZ53SZ7H55E";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WSOL = "So11111111111111111111111111111111111111112";

function pool(base: string) {
  return { id: `solana_pool_${base}`, type: "pool", relationships: { base_token: { data: { id: `solana_${base}`, type: "token" } } } };
}
function token(address: string, symbol: string) {
  return { id: `solana_${address}`, type: "token", attributes: { address, symbol, name: symbol } };
}

const BODY = {
  data: [pool(MEME), pool(MEME), pool(WSOL), pool(USDC), pool(XRP_COPY), pool(OTHER)],
  included: [token(MEME, "Frank"), token(WSOL, "SOL"), token(USDC, "USDC"), token(XRP_COPY, "XRP"), token(OTHER, "JEANPHIL")],
};

describe("trending coins", () => {
  it("dedupes base tokens and skips SOL, stables, and non-Solana majors", () => {
    expect(parseTrendingPools(BODY)).toEqual([
      { mint: MEME, symbol: "Frank" },
      { mint: OTHER, symbol: "JEANPHIL" },
    ]);
  });

  it("makes one request and returns [] on an API error", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify(BODY), { status: 200 }));
    expect(await listTrendingSolana(ok as unknown as typeof fetch)).toHaveLength(2);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledWith(TRENDING_URL, expect.anything());
    const down = vi.fn(async () => new Response("rate limited", { status: 429 }));
    expect(await listTrendingSolana(down as unknown as typeof fetch)).toEqual([]);
    const thrown = vi.fn(async () => {
      throw new Error("timeout");
    });
    expect(await listTrendingSolana(thrown as unknown as typeof fetch)).toEqual([]);
  });
});

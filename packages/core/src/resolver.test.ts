import { describe, expect, it } from "vitest";
import { FIXTURES } from "./providers/mock.js";
import { MockTokenDataProvider } from "./providers/mock.js";
import { extractTokenCandidates, resolveToken } from "./resolver.js";

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
    expect(resolved).toMatchObject({ mint: FIXTURES.danger.mint, via: "mint" });
  });

  it("resolves a ticker when no address is present", async () => {
    const provider = new MockTokenDataProvider();
    const resolved = await resolveToken("@askLens is this legit? $safe", provider);
    expect(resolved).toMatchObject({ mint: FIXTURES.safe.mint, symbol: "SAFE", via: "symbol" });
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

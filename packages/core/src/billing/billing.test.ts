import { describe, expect, it } from "vitest";
import { USDC_MINT_MAINNET, loadConfig } from "../config.js";
import { MemoryStore } from "../store/memory.js";
import { confirmUsdcCheckout, startUsdcCheckout } from "./service.js";
import {
  createCardRail,
  parseParsedTransaction,
  paymentSatisfied,
  solanaPayUrl,
  usdcRaw,
  type PaymentChain,
} from "./solana-pay.js";

const treasury = "6bzZwnSvBLur1xr9baRyHZ3Ck4GgiUCUZf8YQ3oXBEm5";

function config() {
  return loadConfig({
    PRO_TREASURY_WALLET: treasury,
    PRO_PRICE_USDC: "10",
    PRO_PERIOD_DAYS: "30",
    USDC_MINT: USDC_MINT_MAINNET,
  });
}

describe("solana pay", () => {
  it("builds a reference transfer URL and accepts a matching balance change", () => {
    const url = solanaPayUrl({
      recipient: treasury,
      amountUsd: 10,
      splToken: USDC_MINT_MAINNET,
      reference: "Ref111111111111111111111111111111111111111",
    });
    expect(url.startsWith(`solana:${treasury}?`)).toBe(true);
    expect(url).toContain("spl-token=");
    expect(url).toContain("reference=");
    expect(usdcRaw(10).toString()).toBe("10000000");

    const observed = {
      signature: "sig",
      accountKeys: [treasury, "Ref111111111111111111111111111111111111111"],
      pre: [{ owner: treasury, mint: USDC_MINT_MAINNET, amount: "0" }],
      post: [{ owner: treasury, mint: USDC_MINT_MAINNET, amount: "10000000" }],
    };
    expect(
      paymentSatisfied({
        payment: {
          reference: "Ref111111111111111111111111111111111111111",
          recipient: treasury,
          mint: USDC_MINT_MAINNET,
          amountRaw: "10000000",
        },
        observed,
      }),
    ).toBe(true);
    expect(
      paymentSatisfied({
        payment: {
          reference: "Ref111111111111111111111111111111111111111",
          recipient: treasury,
          mint: USDC_MINT_MAINNET,
          amountRaw: "10000000",
        },
        observed: { ...observed, post: [{ owner: treasury, mint: USDC_MINT_MAINNET, amount: "1" }] },
      }),
    ).toBe(false);
  });

  it("reads jsonParsed token balances", () => {
    const parsed = parseParsedTransaction({
      transaction: { message: { accountKeys: [{ pubkey: "ref" }, "payer"] } },
      meta: {
        preTokenBalances: [{ owner: treasury, mint: USDC_MINT_MAINNET, uiTokenAmount: { amount: "5" } }],
        postTokenBalances: [{ owner: treasury, mint: USDC_MINT_MAINNET, uiTokenAmount: { amount: "15" } }],
      },
    });
    expect(parsed?.accountKeys).toEqual(["ref", "payer"]);
    expect(parsed?.post[0]?.amount).toBe("15");
  });

  it("marks the account Pro only after the chain shows the transfer", async () => {
    const store = new MemoryStore();
    const cfg = config();
    let paid = false;
    const chain: PaymentChain = {
      async findPayments(reference) {
        if (!paid) return [];
        return [
          {
            signature: "paid-sig",
            accountKeys: [reference, treasury],
            pre: [],
            post: [{ owner: treasury, mint: USDC_MINT_MAINNET, amount: "10000000" }],
          },
        ];
      },
    };
    const started = await startUsdcCheckout({ config: cfg, store, chain }, { xHandle: "@Trader", wallet: treasury });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.user.xHandle).toBe("trader");
    const early = await confirmUsdcCheckout({ config: cfg, store, chain }, started.session.reference);
    expect(early.ok).toBe(false);
    paid = true;
    const confirmed = await confirmUsdcCheckout(
      { config: cfg, store, chain },
      started.session.reference,
      new Date("2026-09-29T00:00:00.000Z"),
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.signature).toBe("paid-sig");
    expect(confirmed.user.tier).toBe("pro");
    expect(confirmed.user.proUntil?.startsWith("2026-10-29")).toBe(true);
    const again = await confirmUsdcCheckout({ config: cfg, store, chain }, started.session.reference);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.already).toBe(true);
  });

  it("distinguishes a missing reference, a short transfer, and an expired checkout", async () => {
    const store = new MemoryStore();
    const cfg = config();
    let mode: "none" | "short" | "full" = "none";
    const chain: PaymentChain = {
      async findPayments(reference) {
        if (mode === "none") return [];
        const amount = mode === "full" ? "10000000" : "1000000";
        return [
          {
            signature: mode === "full" ? "full-sig" : "short-sig",
            accountKeys: [reference, treasury],
            pre: [{ owner: treasury, mint: USDC_MINT_MAINNET, amount: "0" }],
            post: [{ owner: treasury, mint: USDC_MINT_MAINNET, amount }],
          },
        ];
      },
    };
    const deps = { config: cfg, store, chain };
    const missing = await confirmUsdcCheckout(deps, "missing-reference");
    expect(missing).toMatchObject({ ok: false, reason: "not_found" });

    const started = await startUsdcCheckout(deps, { xHandle: "payer" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const pending = await confirmUsdcCheckout(deps, started.session.reference);
    expect(pending).toMatchObject({ ok: false, reason: "pending" });

    mode = "short";
    const short = await confirmUsdcCheckout(deps, started.session.reference);
    expect(short).toMatchObject({ ok: false, reason: "wrong_amount" });

    mode = "none";
    const expired = await confirmUsdcCheckout(
      deps,
      started.session.reference,
      new Date(Date.now() + 25 * 60 * 60 * 1000),
    );
    expect(expired).toMatchObject({ ok: false, reason: "expired" });

    mode = "full";
    const late = await confirmUsdcCheckout(
      deps,
      started.session.reference,
      new Date(Date.now() + 48 * 60 * 60 * 1000),
    );
    expect(late.ok).toBe(true);
    if (late.ok) expect(late.user.tier).toBe("pro");
  });

  it("does not rebind an existing account during checkout", async () => {
    const store = new MemoryStore();
    const cfg = config();
    const victimWallet = "6bzZwnSvBLur1xr9baRyHZ3Ck4GgiUCUZf8YQ3oXBEm5";
    const attackerWallet = "6CdesJcNbTV5bJ1zVuRNmvbtVtgT3ccchyNT5MbKuKTM";
    await store.upsertUser({ xHandle: "victim", wallet: victimWallet });
    const taken = await startUsdcCheckout(
      { config: cfg, store, chain: { async findPayments() { return []; } } },
      { xHandle: "victim", wallet: attackerWallet },
    );
    expect(taken.ok).toBe(false);
    expect((await store.findUser({ xHandle: "victim" }))?.wallet).toBe(victimWallet);

    await store.upsertUser({ xHandle: "mentiononly" });
    const bind = await startUsdcCheckout(
      { config: cfg, store, chain: { async findPayments() { return []; } } },
      { xHandle: "mentiononly", wallet: victimWallet },
    );
    expect(bind.ok).toBe(false);
    expect((await store.findUser({ xHandle: "mentiononly" }))?.wallet).toBeNull();

    const invalid = await startUsdcCheckout(
      { config: cfg, store, chain: { async findPayments() { return []; } } },
      { xHandle: "newpayer", wallet: "not-a-wallet" },
    );
    expect(invalid.ok).toBe(false);
  });

  it("refuses a reused payment signature and extends Pro from the current end", async () => {
    const store = new MemoryStore();
    const cfg = config();
    const chain: PaymentChain = {
      async findPayments(reference) {
        return [
          {
            signature: "same-sig",
            accountKeys: [reference, treasury],
            pre: [],
            post: [{ owner: treasury, mint: USDC_MINT_MAINNET, amount: "10000000" }],
          },
        ];
      },
    };
    const deps = { config: cfg, store, chain };
    const first = await startUsdcCheckout(deps, { xHandle: "payer", wallet: treasury });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await store.setProUntil(first.user.id, "2026-12-01T00:00:00.000Z");
    const renewed = await confirmUsdcCheckout(deps, first.session.reference, new Date("2026-11-01T00:00:00.000Z"));
    expect(renewed.ok).toBe(true);
    if (!renewed.ok) return;
    expect(renewed.user.proUntil?.startsWith("2026-12-31")).toBe(true);

    const second = await startUsdcCheckout(deps, { xHandle: "otherpayer" });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const reused = await confirmUsdcCheckout(deps, second.session.reference);
    expect(reused).toMatchObject({ ok: false, reason: "reused_signature" });
  });

  it("keeps card checkout behind the same rail interface", async () => {
    const card = createCardRail();
    expect(card.id).toBe("card");
    await expect(card.createCheckout({ userId: "u", amountUsd: 10 })).rejects.toThrow(/USDC/);
    expect(await card.confirm("ref")).toEqual({ ok: false, reason: "card_not_configured" });
  });
});

import { describe, expect, it } from "vitest";
import { USDC_MINT_MAINNET, loadConfig } from "./config.js";
import { confirmUsdcCheckout, startUsdcCheckout } from "./billing/service.js";
import { usdcRaw, type PaymentChain } from "./billing/solana-pay.js";
import { processMention, type LensDeps } from "./pipeline.js";
import { hashReply } from "./proof/hash.js";
import { createMockProofPublisher } from "./proof/mock.js";
import { FIXTURES, MockTokenDataProvider } from "./providers/mock.js";
import { createReplyWriter } from "./reply/writer.js";
import { buildTemplateReply, enforceReplyPolicy } from "./reply/policy.js";
import { MemoryStore } from "./store/memory.js";
import { cleanTeamInfo, startVerifiedCheckout, verifiedView, wantsVerifiedPage } from "./verified.js";
import { MockXClient } from "./x/mock.js";

const treasury = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const stranger = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T";
const SAFE = FIXTURES.safe;
const DANGER = FIXTURES.danger;

function setup(env: Record<string, string> = {}) {
  const store = new MemoryStore();
  const provider = new MockTokenDataProvider();
  const config = loadConfig({
    DATA_MODE: "mock",
    PROOF_MODE: "mock",
    LLM_MODE: "template",
    PUBLIC_BASE_URL: "https://lens.example.com",
    PRO_TREASURY_WALLET: treasury,
    PRO_PRICE_USDC: "10",
    VERIFIED_PRICE_USDC: "50",
    VERIFIED_PERIOD_DAYS: "30",
    USDC_MINT: USDC_MINT_MAINNET,
    ...env,
  });
  return { store, provider, config };
}

/** A chain that reports one transfer of `usdc` to the treasury carrying `reference`. */
function paidChain(reference: () => string, usdc: number): PaymentChain {
  return {
    async findPayments(ref) {
      if (ref !== reference()) return [];
      return [
        {
          signature: `sig_${ref}_${usdc}`,
          accountKeys: [treasury, ref],
          pre: [{ owner: treasury, mint: USDC_MINT_MAINNET, amount: "0" }],
          post: [{ owner: treasury, mint: USDC_MINT_MAINNET, amount: usdcRaw(usdc).toString() }],
        },
      ];
    },
  };
}

async function buyListing(ctx: ReturnType<typeof setup>, mint: string, wallet: string) {
  let reference = "";
  const chain = paidChain(() => reference, 50);
  const started = await startVerifiedCheckout({ ...ctx, chain }, { wallet, mint });
  if (!started.ok) throw new Error(started.error);
  reference = started.session.reference;
  const confirmed = await confirmUsdcCheckout({ ...ctx, chain }, reference);
  if (!confirmed.ok) throw new Error(confirmed.error);
  return confirmed;
}

const noChain: PaymentChain = { async findPayments() { return []; } };

describe("verified checkout", () => {
  it("only lets the token's creator wallet start a checkout", async () => {
    const ctx = setup();
    const wrong = await startVerifiedCheckout({ ...ctx, chain: noChain }, { wallet: stranger, mint: SAFE.mint });
    expect(wrong).toEqual({ ok: false, error: "Pay from the wallet that created this token." });
    const right = await startVerifiedCheckout({ ...ctx, chain: noChain }, { wallet: SAFE.creatorWallet, mint: SAFE.mint });
    expect(right.ok).toBe(true);
    if (right.ok) expect(right.session.amountRaw).toBe(usdcRaw(50).toString());
  });

  it("refuses a token whose creator is unknown", async () => {
    const ctx = setup();
    ctx.provider.getToken = async (mint) => {
      const snapshot = await new MockTokenDataProvider().getToken(mint);
      return snapshot ? { ...snapshot, creatorWallet: null } : null;
    };
    const result = await startVerifiedCheckout({ ...ctx, chain: noChain }, { wallet: SAFE.creatorWallet, mint: SAFE.mint });
    expect(result.ok).toBe(false);
  });

  it("refuses a second wallet while another wallet's listing is active", async () => {
    const ctx = setup();
    await buyListing(ctx, SAFE.mint, SAFE.creatorWallet);
    ctx.provider.getToken = async (mint) => {
      const snapshot = await new MockTokenDataProvider().getToken(mint);
      return snapshot ? { ...snapshot, creatorWallet: stranger } : null;
    };
    const result = await startVerifiedCheckout({ ...ctx, chain: noChain }, { wallet: stranger, mint: SAFE.mint });
    expect(result).toEqual({ ok: false, error: "This token already has an active Verified page." });
  });

  it("activates the listing only after the transfer is on-chain, and never sets Pro", async () => {
    const ctx = setup();
    const started = await startVerifiedCheckout({ ...ctx, chain: noChain }, { wallet: SAFE.creatorWallet, mint: SAFE.mint });
    if (!started.ok) throw new Error(started.error);
    const pending = await confirmUsdcCheckout({ ...ctx, chain: noChain }, started.session.reference);
    expect(pending.ok).toBe(false);
    expect(await ctx.store.getVerifiedListing(SAFE.mint)).toBeNull();

    const now = new Date("2026-10-11T00:00:00.000Z");
    const paid = await confirmUsdcCheckout({ ...ctx, chain: paidChain(() => started.session.reference, 50) }, started.session.reference, now);
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.purpose).toBe("verified");
    expect(paid.verifiedUntil).toBe("2026-11-10T00:00:00.000Z");
    expect(paid.user.proUntil).toBeNull();
    const listing = await ctx.store.getVerifiedListing(SAFE.mint);
    expect(listing?.ownerWallet).toBe(SAFE.creatorWallet);
  });

  it("does not accept a Pro-sized transfer for a Verified checkout", async () => {
    const ctx = setup();
    const started = await startVerifiedCheckout({ ...ctx, chain: noChain }, { wallet: SAFE.creatorWallet, mint: SAFE.mint });
    if (!started.ok) throw new Error(started.error);
    const chain = paidChain(() => started.session.reference, 10);
    const result = await confirmUsdcCheckout({ ...ctx, chain }, started.session.reference);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong_amount");
    expect(await ctx.store.getVerifiedListing(SAFE.mint)).toBeNull();
  });

  it("a Pro payment never creates a listing", async () => {
    const ctx = setup();
    let reference = "";
    const chain = paidChain(() => reference, 10);
    const started = await startUsdcCheckout({ ...ctx, chain }, { wallet: stranger });
    if (!started.ok) throw new Error(started.error);
    reference = started.session.reference;
    const confirmed = await confirmUsdcCheckout({ ...ctx, chain }, reference);
    expect(confirmed.ok && confirmed.purpose).toBe("pro");
    expect(await ctx.store.listActiveVerified(new Date())).toEqual([]);
  });
});

describe("verified view", () => {
  const now = new Date("2026-10-11T12:00:00.000Z");
  const active = { paidUntil: "2026-11-01T00:00:00.000Z" };
  const lapsed = { paidUntil: "2026-10-01T00:00:00.000Z" };
  const fresh = (riskLevel: "LOW" | "MEDIUM" | "HIGH") => ({
    riskLevel,
    createdAt: "2026-10-11T11:55:00.000Z",
    dataMode: "live" as const,
  });

  it("shows the badge only for an active listing with a fresh LOW check", () => {
    expect(verifiedView(active, fresh("LOW"), now).badge).toBe(true);
    expect(verifiedView(active, fresh("MEDIUM"), now).badge).toBe(false);
    expect(verifiedView(active, fresh("HIGH"), now).badge).toBe(false);
    expect(verifiedView(lapsed, fresh("LOW"), now).badge).toBe(false);
    expect(verifiedView(null, fresh("LOW"), now).badge).toBe(false);
    expect(verifiedView(active, { ...fresh("LOW"), createdAt: "2026-10-11T11:00:00.000Z" }, now).badge).toBe(false);
    expect(verifiedView(active, null, now)).toMatchObject({ badge: false, level: "NONE" });
  });

  it("passes the check's level through untouched", () => {
    expect(verifiedView(active, fresh("HIGH"), now).level).toBe("HIGH");
  });
});

describe("team links", () => {
  it("keeps https links and rejects anything else", () => {
    const ok = cleanTeamInfo({ website: " https://coin.example.com ", auditUrl: "" });
    expect(ok).toEqual({
      ok: true,
      info: { website: "https://coin.example.com/", xUrl: null, telegramUrl: null, auditUrl: null, lockProofUrl: null },
    });
    expect(cleanTeamInfo({ website: "http://coin.example.com" }).ok).toBe(false);
    expect(cleanTeamInfo({ auditUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(cleanTeamInfo({ xUrl: "https://user:pw@x.com/coin" }).ok).toBe(false);
    expect(cleanTeamInfo({ lockProofUrl: `https://a.com/${"x".repeat(300)}` }).ok).toBe(false);
  });
});

describe("verify command", () => {
  it("matches verify followed by a ticker or a mint", () => {
    expect(wantsVerifiedPage("@justasklens verify $SAFE")).toBe(true);
    expect(wantsVerifiedPage(`@justasklens verify ${SAFE.mint}`)).toBe(true);
    expect(wantsVerifiedPage("@justasklens $SAFE")).toBe(false);
    expect(wantsVerifiedPage("@justasklens is $SAFE verified")).toBe(false);
  });

  function mentionDeps(ctx: ReturnType<typeof setup>): { rt: LensDeps; x: MockXClient } {
    const x = new MockXClient();
    const rt: LensDeps = {
      config: ctx.config,
      store: ctx.store,
      provider: ctx.provider,
      proofs: createMockProofPublisher(ctx.store),
      writer: createReplyWriter(ctx.config),
      x,
    };
    return { rt, x };
  }

  async function ask(ctx: ReturnType<typeof setup>, id: string, text: string) {
    const { rt, x } = mentionDeps(ctx);
    const result = await processMention(rt, { id, authorId: `u_${id}`, authorUsername: `user_${id}`, text });
    if (result.status !== "replied") throw new Error(result.status);
    return { result, posted: x.replies[0]!.text, check: (await ctx.store.getCheck(result.checkId))! };
  }

  it("keeps the engine's level whether or not the coin paid", async () => {
    const ctx = setup();
    const plain = await ask(ctx, "m1", "@justasklens $SAFE");
    const unlisted = await ask(ctx, "m2", "@justasklens verify $SAFE");
    await buyListing(ctx, SAFE.mint, SAFE.creatorWallet);
    const listed = await ask(ctx, "m3", "@justasklens verify $SAFE");
    expect(new Set([plain.result.riskLevel, unlisted.result.riskLevel, listed.result.riskLevel]).size).toBe(1);
    expect(plain.posted).not.toContain("Lens Verified");
    expect(unlisted.posted).toContain("No Lens Verified page.");
    expect(listed.posted).toContain(`Lens Verified page: https://lens.example.com/verified/${SAFE.mint}`);
    expect(listed.posted.trim().endsWith("Not financial advice.")).toBe(true);
    // The proof covers the exact text that was posted, Verified line included.
    expect(listed.check.proof?.contentHash).toBe(hashReply(listed.posted));
  });

  it("a paid HIGH coin stays HIGH with no badge", async () => {
    const ctx = setup();
    await buyListing(ctx, DANGER.mint, DANGER.creatorWallet);
    const { result, check } = await ask(ctx, "m4", "@justasklens verify $DANGER");
    expect(result.riskLevel).toBe("HIGH");
    const listing = await ctx.store.getVerifiedListing(DANGER.mint);
    expect(verifiedView(listing, check).badge).toBe(false);
  });

  it("says the page exists without a URL when the site is not public", async () => {
    const ctx = setup({ PUBLIC_BASE_URL: "http://127.0.0.1:3847" });
    await buyListing(ctx, SAFE.mint, SAFE.creatorWallet);
    const { posted } = await ask(ctx, "m5", "@justasklens verify $SAFE");
    expect(posted).toContain("Has a Lens Verified page.");
    expect(posted).not.toContain("http");
  });

  it("posts nothing when the proof fails", async () => {
    const ctx = setup();
    const { rt, x } = mentionDeps(ctx);
    rt.proofs.publish = async () => {
      throw new Error("rpc down");
    };
    const result = await processMention(rt, { id: "m6", authorId: "u6", authorUsername: "u6", text: "@justasklens verify $SAFE" });
    expect(result.status).toBe("skipped");
    expect(x.replies).toEqual([]);
  });
});

describe("verified reply line", () => {
  const base = {
    riskLevel: "MEDIUM" as const,
    symbol: "MID",
    name: "Mid",
    mint: FIXTURES.mid.mint,
    facts: [],
    reportUrl: "https://lens.example.com/r/1",
  };

  it("keeps the Verified URL as the only link, above the disclaimer", () => {
    const input = { ...base, includeLinks: true, verified: { active: true, url: "https://lens.example.com/verified/x" } };
    const enforced = enforceReplyPolicy(buildTemplateReply(input), input);
    expect(enforced.ok).toBe(true);
    const lines = enforced.text.split("\n");
    expect(lines.at(-1)).toBe("Not financial advice.");
    expect(lines.at(-2)).toBe("Lens Verified page: https://lens.example.com/verified/x");
    expect(enforced.text).not.toContain("/r/1");
    expect(enforced.text.length).toBeLessThanOrEqual(500);
  });

  it("drops a URL for an inactive listing", () => {
    const input = { ...base, verified: { active: false, url: "https://lens.example.com/verified/x" } };
    const enforced = enforceReplyPolicy(buildTemplateReply(input), input);
    expect(enforced.text).toContain("No Lens Verified page.");
    expect(enforced.text).not.toContain("https://");
  });
});

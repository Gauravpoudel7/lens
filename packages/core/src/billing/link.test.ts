import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { utcDay } from "../ids.js";
import { MockTokenDataProvider } from "../providers/mock.js";
import { createMockProofPublisher } from "../proof/mock.js";
import { createReplyWriter } from "../reply/writer.js";
import { MemoryStore } from "../store/memory.js";
import { MockXClient } from "../x/mock.js";
import { pollDmLinks } from "../poll.js";
import type { LensDeps } from "../pipeline.js";
import { LINK_FAILURES_PER_DAY, issueOrReuseLinkCode, parseLinkCode, redeemLinkCode } from "./link.js";

const WALLET = "6bzZwnSvBLur1xr9baRyHZ3Ck4GgiUCUZf8YQ3oXBEm5";
const OTHER_WALLET = "6CdesJcNbTV5bJ1zVuRNmvbtVtgT3ccchyNT5MbKuKTM";
const NOW = new Date("2026-10-08T12:00:00.000Z");
const config = loadConfig({ DATA_MODE: "mock", PROOF_MODE: "mock", PUBLIC_BASE_URL: "https://asklens.com" });

async function paidAccount(store: MemoryStore, wallet = WALLET) {
  const user = await store.upsertUser({ wallet });
  return store.setProUntil(user.id, "2099-01-01T00:00:00.000Z");
}

function redeem(store: MemoryStore, text: string, senderId = "x_1", senderHandle = "Trader", now = NOW) {
  return redeemLinkCode({ store, config }, { senderId, senderHandle, text, now });
}

describe("Pro link codes", () => {
  it("issues one code to an active, unlinked Pro account and reuses it until it expires", async () => {
    const store = new MemoryStore();
    const free = await store.upsertUser({ wallet: OTHER_WALLET });
    expect(await issueOrReuseLinkCode(store, free, NOW)).toBeNull();
    const pro = await paidAccount(store);
    const first = await issueOrReuseLinkCode(store, pro, NOW);
    expect(first?.code).toMatch(/^LENS-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect((await issueOrReuseLinkCode(store, pro, NOW))?.code).toBe(first?.code);
    const later = await issueOrReuseLinkCode(store, pro, new Date(NOW.getTime() + 25 * 3600_000));
    expect(later?.code).not.toBe(first?.code);
  });

  it("finds a code in a DM regardless of case and spacing", () => {
    expect(parseLinkCode("hi! lens-ab12-cd34 thanks")).toBe("LENS-AB12-CD34");
    expect(parseLinkCode("LENS AB12 CD34")).toBe("LENS-AB12-CD34");
    expect(parseLinkCode("no code here")).toBeNull();
  });

  it("links the X account that sent a valid code, once", async () => {
    const store = new MemoryStore();
    const pro = await paidAccount(store);
    const code = await issueOrReuseLinkCode(store, pro, NOW);
    const result = await redeem(store, `here: ${code!.code}`);
    expect(result).toEqual({ outcome: "linked", reply: "Linked. Lens Pro is on for @trader." });
    const linked = await store.getUser(pro.id);
    expect(linked).toMatchObject({ xUserId: "x_1", xHandle: "trader", wallet: WALLET });
    expect(linked?.xLinkedAt).toBe(NOW.toISOString());
    expect((await store.getLinkCode(code!.code))?.usedByXUserId).toBe("x_1");
    expect((await redeem(store, code!.code)).outcome).toBe("already");
    expect(await redeem(store, code!.code, "x_2", "someone")).toEqual({ outcome: "used", reply: "That code was already used." });
  });

  it("refuses wrong and expired codes", async () => {
    const store = new MemoryStore();
    const pro = await paidAccount(store);
    const code = await issueOrReuseLinkCode(store, pro, NOW);
    expect(await redeem(store, "LENS-0000-0000")).toEqual({
      outcome: "wrong",
      reply: "That code is not valid. Get a new one at https://asklens.com/account.",
    });
    const late = await redeem(store, code!.code, "x_1", "trader", new Date(NOW.getTime() + 24 * 3600_000 + 1));
    expect(late.outcome).toBe("expired");
    expect((await store.getUser(pro.id))?.xUserId).toBeNull();
  });

  it("refuses when this X account or handle already belongs to another wallet", async () => {
    const store = new MemoryStore();
    await store.upsertUser({ xHandle: "trader", wallet: OTHER_WALLET });
    const pro = await paidAccount(store);
    const code = await issueOrReuseLinkCode(store, pro, NOW);
    expect(await redeem(store, code!.code)).toEqual({
      outcome: "taken",
      reply: "This X account is already linked to another Lens Pro wallet.",
    });
    expect((await store.getUser(pro.id))?.xLinkedAt).toBeNull();
    expect((await store.getLinkCode(code!.code))?.usedAt).toBeNull();
  });

  it("refuses a second X account on a wallet that is already linked", async () => {
    const store = new MemoryStore();
    const pro = await paidAccount(store);
    const code = await issueOrReuseLinkCode(store, pro, NOW);
    await redeem(store, code!.code);
    // No new code is issued for a linked account, so a stolen old code is the only way in, and it is used.
    expect(await issueOrReuseLinkCode(store, (await store.getUser(pro.id))!, NOW)).toBeNull();
    expect((await redeem(store, code!.code, "x_9", "thief")).outcome).toBe("used");
  });

  it("folds an old wallet-less Free account for the same handle into the paid account", async () => {
    const store = new MemoryStore();
    const old = await store.upsertUser({ xHandle: "trader" });
    await store.addWatch(old.id, "MintA", "A");
    const pro = await paidAccount(store);
    await store.addWatch(pro.id, "MintA", "A");
    await store.addWatch(old.id, "MintB", "B");
    const code = await issueOrReuseLinkCode(store, pro, NOW);
    expect((await redeem(store, code!.code)).outcome).toBe("linked");
    expect(await store.getUser(old.id)).toBeNull();
    expect((await store.findUser({ xHandle: "trader" }))?.id).toBe(pro.id);
    expect((await store.listWatches(pro.id)).map((w) => w.mint).sort()).toEqual(["MintA", "MintB"]);
  });

  it("stops answering an X account after five failed codes in a day", async () => {
    const store = new MemoryStore();
    await paidAccount(store);
    for (let i = 0; i < LINK_FAILURES_PER_DAY; i++) {
      expect((await redeem(store, "LENS-0000-000" + i)).outcome).toBe("wrong");
    }
    expect(await redeem(store, "LENS-0000-0009")).toEqual({ outcome: "ignored", reply: null });
    expect(await store.getDailyCount("linkfail:x_1", utcDay(NOW))).toBe(LINK_FAILURES_PER_DAY);
    expect(await redeem(store, "just saying hi", "x_2")).toEqual({ outcome: "ignored", reply: null });
  });
});

describe("DM polling for link codes", () => {
  function deps() {
    const store = new MemoryStore();
    const x = new MockXClient();
    const rt: LensDeps = {
      config,
      store,
      provider: new MockTokenDataProvider(),
      proofs: createMockProofPublisher(store),
      writer: createReplyWriter(config),
      x,
    };
    return { rt, store, x };
  }

  it("does not read DMs while no paid account is waiting to link", async () => {
    const { rt, x } = deps();
    expect((await pollDmLinks(rt, NOW)).read).toBe(false);
    expect(x.dmReads).toBe(0);
  });

  it("reads at most every three minutes, links once, and answers once per DM", async () => {
    const { rt, store, x } = deps();
    const pro = await paidAccount(store);
    const code = await issueOrReuseLinkCode(store, pro, NOW);
    x.inbox.push({ id: "100", senderId: "x_1", senderUsername: "Trader", text: code!.code, createdAt: NOW.toISOString() });
    const first = await pollDmLinks(rt, NOW);
    expect(first).toEqual({ read: true, linked: 1, replied: 1 });
    expect(x.dms).toEqual([expect.objectContaining({ recipientId: "x_1", text: "Linked. Lens Pro is on for @trader." })]);

    const pro2 = await paidAccount(store, OTHER_WALLET);
    const code2 = await issueOrReuseLinkCode(store, pro2, NOW);
    x.inbox.push({ id: "101", senderId: "x_2", senderUsername: "other", text: code2!.code, createdAt: NOW.toISOString() });
    expect((await pollDmLinks(rt, new Date(NOW.getTime() + 60_000))).read).toBe(false);
    expect(x.dmReads).toBe(1);

    const later = await pollDmLinks(rt, new Date(NOW.getTime() + 180_000));
    expect(later).toEqual({ read: true, linked: 1, replied: 1 });
    expect(x.dms).toHaveLength(2);
    expect(await store.getCursor("dms")).toBe("101");
  });

  it("floors X_DM_POLL_MS at three minutes", () => {
    expect(loadConfig({ X_DM_POLL_MS: "1000" }).xDmPollMs).toBe(180_000);
    expect(loadConfig({ X_DM_POLL_MS: "600000" }).xDmPollMs).toBe(600_000);
  });
});

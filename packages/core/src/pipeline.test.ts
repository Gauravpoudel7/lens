import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { utcDay } from "./ids.js";
import { FIXTURES } from "./providers/mock.js";
import { MockTokenDataProvider } from "./providers/mock.js";
import { createReplyWriter } from "./reply/writer.js";
import { hashReply } from "./proof/hash.js";
import { createMockProofPublisher } from "./proof/mock.js";
import { verifyPostedText } from "./proof/verify.js";
import { MemoryStore } from "./store/memory.js";
import { X_REPLY_COUNTER_ID, createRiskCheck, processMention, publishOutbound, type LensDeps } from "./pipeline.js";
import { scoreDueChecks } from "./outcomes.js";
import { MockXClient } from "./x/mock.js";
import type { XPost } from "./x/types.js";

function deps(
  rateLimit = 5,
  extra: Record<string, string> = {},
): { rt: LensDeps; x: MockXClient; provider: MockTokenDataProvider; store: MemoryStore } {
  const store = new MemoryStore();
  const provider = new MockTokenDataProvider();
  const x = new MockXClient();
  const config = loadConfig({
    DATA_MODE: "mock",
    PROOF_MODE: "mock",
    LLM_MODE: "template",
    PUBLIC_BASE_URL: "http://127.0.0.1:3847",
    RATE_LIMIT_PER_USER_PER_DAY: String(rateLimit),
    ...extra,
    OUTCOME_WINDOW_DAYS: "7",
    SHARP_DROP_PCT: "-30",
    CALL_WIN_PCT: "20",
  });
  const rt: LensDeps = {
    config,
    store,
    provider,
    proofs: createMockProofPublisher(store),
    writer: createReplyWriter(config),
    x,
  };
  return { rt, x, provider, store };
}

function parent(): XPost {
  return {
    id: "parent_1",
    authorId: "promoter",
    authorUsername: "mooncalls",
    text: `Just aped $DANGER. CA: ${FIXTURES.danger.mint} LP locked and burned. 100x soon`,
    parentId: null,
    createdAt: "2026-09-29T12:00:00.000Z",
  };
}

describe("mention pipeline", () => {
  it("proves the exact reply before posting it", async () => {
    const { rt, x, store } = deps();
    x.seed(parent());
    const order: string[] = [];
    const originalPublish = rt.proofs.publish.bind(rt.proofs);
    rt.proofs.publish = async (payload) => {
      order.push("prove");
      return originalPublish(payload);
    };
    const originalReply = x.reply.bind(x);
    x.reply = async (input) => {
      order.push("reply");
      return originalReply(input);
    };

    const result = await processMention(rt, {
      id: "mention_1",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: "@askLens is this legit?",
      parentId: "parent_1",
    });

    expect(order).toEqual(["prove", "reply"]);
    expect(result.status).toBe("replied");
    if (result.status !== "replied") return;
    expect(result.riskLevel).toBe("HIGH");
    expect(result.replyText).not.toMatch(/scam/i);
    expect(result.replyText).toContain("5bSU…Ggko");
    expect(result.replyText).not.toContain("Full report");
    expect(result.replyText).not.toContain("could not be verified");
    expect(result.replyText).not.toMatch(/https?:\/\//);
    expect(result.replyText.endsWith("Not financial advice.")).toBe(true);
    expect(result.replyText).toMatch(/does not match/i);
    expect(result.replyText.length).toBeLessThanOrEqual(280);
    const check = await store.getCheck(result.checkId);
    expect(check?.proof?.payload).toContain(hashReply(result.replyText));
    const verified = await verifyPostedText(rt.proofs, result.replyText, check!.proof!.txSignature!);
    expect(verified.ok).toBe(true);
    const tampered = await verifyPostedText(
      rt.proofs,
      result.replyText.replace("HIGH", "LOW"),
      check!.proof!.txSignature!,
    );
    expect(tampered.ok).toBe(false);
    expect(x.replies[0]?.text).toBe(result.replyText);
  });

  it("does not post again when that mention already has a reply id", async () => {
    const { rt, x, store } = deps();
    x.seed(parent());
    const first = await processMention(rt, {
      id: "mention_1",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: "@askLens is this legit?",
      parentId: "parent_1",
    });
    expect(first.status).toBe("replied");
    await store.updateMention("mention_1", { status: "processing" });
    const before = x.replies.length;
    const second = await processMention(rt, {
      id: "mention_1",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: "@askLens is this legit?",
      parentId: "parent_1",
    });
    expect(second.status).toBe("already_done");
    expect(x.replies.length).toBe(before);
    expect((await store.getMention("mention_1"))?.status).toBe("replied");
  });

  it("reuses the proved reply for a second ask on the same post", async () => {
    const { rt, x, store } = deps();
    x.seed(parent());
    const first = await processMention(rt, {
      id: "mention_1",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: "@askLens is this legit?",
      parentId: "parent_1",
    });
    const second = await processMention(rt, {
      id: "mention_2",
      authorId: "user_2",
      authorUsername: "other",
      text: "@askLens thoughts?",
      parentId: "parent_1",
    });
    expect(first.status).toBe("replied");
    expect(second.status).toBe("replied");
    if (first.status !== "replied" || second.status !== "replied") return;
    expect(second.cached).toBe(true);
    expect(second.checkId).toBe(first.checkId);
    expect(second.replyText).toBe(first.replyText);
    expect([...store.checks.values()]).toHaveLength(1);
    expect(x.replies).toHaveLength(2);
  });

  it("stops a user who is over the daily limit before a new proof", async () => {
    const { rt, x, store } = deps(1);
    x.seed(parent());
    const ok = await processMention(rt, {
      id: "mention_1",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: `@askLens ${FIXTURES.danger.mint}`,
    });
    const limited = await processMention(rt, {
      id: "mention_2",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: `@askLens ${FIXTURES.safe.mint}`,
    });
    expect(ok.status).toBe("replied");
    expect(limited.status).toBe("rate_limited");
    expect([...store.checks.values()]).toHaveLength(1);
    expect(x.replies).toHaveLength(1);
  });

  it("stops replying after the bot daily cap, including a Pro account", async () => {
    const { rt, x, store } = deps(5, { MAX_X_REPLIES_PER_DAY: "1" });
    const pro = await store.upsertUser({ xHandle: "pro_user", xUserId: "user_2" });
    await store.setProUntil(pro.id, "2099-01-01T00:00:00.000Z");
    const first = await processMention(rt, {
      id: "mention_1",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: `@askLens ${FIXTURES.danger.mint}`,
    });
    const second = await processMention(rt, {
      id: "mention_2",
      authorId: "user_2",
      authorUsername: "pro_user",
      text: `@askLens ${FIXTURES.safe.mint}`,
    });
    expect(first.status).toBe("replied");
    expect(second.status).toBe("rate_limited");
    expect(x.replies).toHaveLength(1);
    const mention = await store.getMention("mention_2");
    expect(mention?.skipReason).toBe("bot daily reply cap");
  });

  it("lets a Pro account keep asking after the free daily cap", async () => {
    const { rt, x } = deps(1);
    const user = await rt.store.upsertUser({ xHandle: "trader_joe", wallet: "wallet" });
    await rt.store.setProUntil(user.id, "2099-01-01T00:00:00.000Z");
    const first = await processMention(rt, {
      id: "mention_1",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: `@askLens ${FIXTURES.danger.mint}`,
    });
    const second = await processMention(rt, {
      id: "mention_2",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: `@askLens ${FIXTURES.safe.mint}`,
    });
    expect(first.status).toBe("replied");
    expect(second.status).toBe("replied");
    expect(x.replies).toHaveLength(2);
    expect(await rt.store.getDailyCount("user_1", utcDay(new Date()))).toBe(0);
  });

  it("replies with a notice for $XRP and does not score a Solana token", async () => {
    const { rt, x } = deps();
    const result = await processMention(rt, {
      id: "mention_xrp",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: "@justasklens is $XRP safe?",
    });
    expect(result.status).toBe("replied");
    if (result.status !== "replied") return;
    expect(result.riskLevel).toBe("NONE");
    expect(result.replyText).toContain("$XRP isn't a Solana-native token");
    expect(result.replyText).not.toMatch(/\b(LOW|MEDIUM|HIGH)\b/);
    expect(result.replyText.endsWith("Not financial advice.")).toBe(true);
    expect(x.replies[0]?.text).toBe(result.replyText);
    const check = await rt.store.getCheck(result.checkId);
    expect(check?.kind).toBe("unresolved");
    expect(check?.proof?.payload).toContain(hashReply(result.replyText));
  });

  it("asks for a contract when the ticker is not one verified token", async () => {
    const { rt } = deps();
    const result = await processMention(rt, {
      id: "mention_jup",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: "@justasklens is $JUP safe?",
    });
    expect(result.status).toBe("replied");
    if (result.status !== "replied") return;
    expect(result.replyText).toContain("Several coins use $JUP");
    expect(result.replyText).not.toMatch(/\b(LOW|MEDIUM|HIGH)\b/);
    expect(result.riskLevel).toBe("NONE");
  });

  it("adds one blink link when a mention asks to buy a LOW token on a public https site", async () => {
    const { rt, x, store } = deps(5, { PUBLIC_BASE_URL: "https://asklens.com", PUBLIC_SITE_NAME: "Lens" });
    const lines = await captureLogs(async () => {
      const result = await processMention(rt, {
        id: "mention_buy",
        authorId: "user_1",
        authorUsername: "trader_joe",
        text: "@justasklens buy $SAFE",
      });
      expect(result.status).toBe("replied");
      if (result.status !== "replied") return;
      const url = `https://asklens.com/trade/${FIXTURES.safe.mint}`;
      expect(result.riskLevel).toBe("LOW");
      expect(result.replyText.match(/https?:\/\/\S+/g)).toEqual([url]);
      expect(result.replyText).toContain(`$SAFE (6bzZ…BEm5)`);
      expect(result.replyText).toContain("Full report on Lens.");
      expect(result.replyText.endsWith("Not financial advice.")).toBe(true);
      expect(result.replyText).not.toMatch(/scam/i);
      const check = await store.getCheck(result.checkId);
      expect(check?.proof?.payload).toContain(hashReply(result.replyText));
      expect(x.replies[0]?.text).toBe(result.replyText);
      expect(await store.getDailyCount("user_1", utcDay(new Date()))).toBe(1);
      expect(await store.getDailyCount(X_REPLY_COUNTER_ID, utcDay(new Date()))).toBe(1);
    });
    expect(lines.some((line) => line.includes("swap link included"))).toBe(true);
  });

  it("does not attach a buy link to a HIGH token", async () => {
    const { rt } = deps(5, { PUBLIC_BASE_URL: "https://asklens.com" });
    const lines = await captureLogs(async () => {
      const result = await processMention(rt, {
        id: "mention_buy_high",
        authorId: "user_1",
        authorUsername: "trader_joe",
        text: `@justasklens buy ${FIXTURES.danger.mint}`,
      });
      expect(result.status).toBe("replied");
      if (result.status !== "replied") return;
      expect(result.riskLevel).toBe("HIGH");
      expect(result.replyText).not.toMatch(/https?:\/\//);
      expect(result.replyText).not.toContain("/trade/");
    });
    expect(lines.some((line) => line.includes("HIGH risk has no buy link"))).toBe(true);
  });

  it("does not attach a link when the ticker is not scored", async () => {
    const { rt } = deps(5, { PUBLIC_BASE_URL: "https://asklens.com" });
    const lines = await captureLogs(async () => {
      const foreign = await processMention(rt, {
        id: "mention_buy_xrp",
        authorId: "user_1",
        authorUsername: "trader_joe",
        text: "@justasklens buy $XRP",
      });
      const copycat = await processMention(rt, {
        id: "mention_swap_jup",
        authorId: "user_1",
        authorUsername: "trader_joe",
        text: "@justasklens swap $JUP",
      });
      expect(foreign.status).toBe("replied");
      expect(copycat.status).toBe("replied");
      if (foreign.status !== "replied" || copycat.status !== "replied") return;
      expect(foreign.replyText).toContain("isn't a Solana-native token");
      expect(copycat.replyText).toContain("Several coins use $JUP");
      expect(foreign.replyText).not.toMatch(/https?:\/\//);
      expect(copycat.replyText).not.toMatch(/https?:\/\//);
    });
    const omitted = lines.filter((line) => line.includes("token was not scored"));
    expect(omitted.length).toBeGreaterThanOrEqual(2);
  });

  it("replies without a link when the site URL is not public https", async () => {
    const { rt } = deps();
    const lines = await captureLogs(async () => {
      const result = await processMention(rt, {
        id: "mention_local_buy",
        authorId: "user_1",
        authorUsername: "trader_joe",
        text: "@justasklens trade $SAFE",
      });
      expect(result.status).toBe("replied");
      if (result.status !== "replied") return;
      expect(result.riskLevel).toBe("LOW");
      expect(result.replyText).not.toMatch(/https?:\/\//);
    });
    expect(lines.some((line) => line.includes("PUBLIC_BASE_URL is not a public https URL"))).toBe(true);
  });

  it("omits the swap link when X_SWAP_LINKS_ON_REQUEST is false", async () => {
    const { rt } = deps(5, {
      PUBLIC_BASE_URL: "https://asklens.com",
      X_SWAP_LINKS_ON_REQUEST: "false",
    });
    const lines = await captureLogs(async () => {
      const result = await processMention(rt, {
        id: "mention_flag_off",
        authorId: "user_1",
        authorUsername: "trader_joe",
        text: "@justasklens buy $SAFE",
      });
      expect(result.status).toBe("replied");
      if (result.status !== "replied") return;
      expect(result.replyText).not.toMatch(/https?:\/\//);
    });
    expect(lines.some((line) => line.includes("X_SWAP_LINKS_ON_REQUEST is false"))).toBe(true);
  });

  it("does not reuse a link-free reply for a later trade ask, and does not reuse a swap reply for a normal ask", async () => {
    const { rt, x, store } = deps(5, { PUBLIC_BASE_URL: "https://asklens.com", PUBLIC_SITE_NAME: "Lens" });
    x.seed({
      id: "parent_safe",
      authorId: "promoter",
      authorUsername: "mooncalls",
      text: "Look at $SAFE",
      parentId: null,
      createdAt: "2026-10-07T12:00:00.000Z",
    });
    const first = await processMention(rt, {
      id: "mention_plain",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: "@justasklens is $SAFE okay?",
      parentId: "parent_safe",
    });
    const buy = await processMention(rt, {
      id: "mention_buy_same",
      authorId: "user_2",
      authorUsername: "other",
      text: "@justasklens buy $SAFE",
      parentId: "parent_safe",
    });
    const again = await processMention(rt, {
      id: "mention_buy_again",
      authorId: "user_3",
      authorUsername: "third",
      text: "@justasklens swap $SAFE",
      parentId: "parent_safe",
    });
    const plain = await processMention(rt, {
      id: "mention_plain_again",
      authorId: "user_4",
      authorUsername: "fourth",
      text: "@justasklens thoughts?",
      parentId: "parent_safe",
    });
    expect(first.status).toBe("replied");
    expect(buy.status).toBe("replied");
    expect(again.status).toBe("replied");
    expect(plain.status).toBe("replied");
    if (first.status !== "replied" || buy.status !== "replied" || again.status !== "replied" || plain.status !== "replied") {
      return;
    }
    const url = `https://asklens.com/trade/${FIXTURES.safe.mint}`;
    expect(first.replyText).not.toMatch(/https?:\/\//);
    expect(buy.replyText.match(/https?:\/\/\S+/g)).toEqual([url]);
    expect(buy.cached).toBe(false);
    expect(buy.checkId).not.toBe(first.checkId);
    expect(again.cached).toBe(true);
    expect(again.checkId).toBe(buy.checkId);
    expect(again.replyText).toBe(buy.replyText);
    expect(plain.cached).toBe(false);
    expect(plain.replyText).not.toMatch(/https?:\/\//);
    expect(plain.checkId).not.toBe(buy.checkId);
    expect([...store.checks.values()].filter((check) => check.tokenMint === FIXTURES.safe.mint)).toHaveLength(3);
  });

  it("rewrites a cached reply that still has the old Blink API link, and proves the new text", async () => {
    const { rt, x, store } = deps(5, { PUBLIC_BASE_URL: "https://asklens.com", PUBLIC_SITE_NAME: "Lens" });
    x.seed({ id: "parent_old", authorId: "promoter", authorUsername: "mooncalls", text: "Look at $SAFE", parentId: null, createdAt: "2026-10-07T12:00:00.000Z" });
    const first = await processMention(rt, { id: "mention_old_1", authorId: "user_1", authorUsername: "a", text: "@justasklens buy $SAFE", parentId: "parent_old" });
    expect(first.status).toBe("replied");
    if (first.status !== "replied") return;
    const stored = store.checks.get(first.checkId);
    if (!stored) throw new Error("check missing");
    const oldUrl = `https://asklens.com/api/actions/trade/${FIXTURES.safe.mint}`;
    stored.replyText = stored.replyText.replace(`https://asklens.com/trade/${FIXTURES.safe.mint}`, oldUrl);
    const next = await processMention(rt, { id: "mention_old_2", authorId: "user_2", authorUsername: "b", text: "@justasklens swap $SAFE", parentId: "parent_old" });
    expect(next.status).toBe("replied");
    if (next.status !== "replied") return;
    const url = `https://asklens.com/trade/${FIXTURES.safe.mint}`;
    expect(next.cached).toBe(false);
    expect(next.replyText.match(/https?:\/\/\S+/g)).toEqual([url]);
    const check = await store.getCheck(next.checkId);
    expect(check?.proof?.payload).toContain(hashReply(next.replyText));
  });

  it("counts a swap reply toward the existing daily caps", async () => {
    const { rt, x } = deps(1, { PUBLIC_BASE_URL: "https://asklens.com", MAX_X_REPLIES_PER_DAY: "1" });
    const first = await processMention(rt, {
      id: "mention_cap_1",
      authorId: "user_1",
      authorUsername: "trader_joe",
      text: "@justasklens buy $SAFE",
    });
    const second = await processMention(rt, {
      id: "mention_cap_2",
      authorId: "user_2",
      authorUsername: "other",
      text: "@justasklens trade $MID",
    });
    expect(first.status).toBe("replied");
    expect(second.status).toBe("rate_limited");
    expect(x.replies).toHaveLength(1);
    expect(await rt.store.getDailyCount(X_REPLY_COUNTER_ID, utcDay(new Date()))).toBe(1);
    expect(await rt.store.getDailyCount("user_1", utcDay(new Date()))).toBe(1);
  });

  it("does not add a swap link on a manual check or an outbound post", async () => {
    const { rt } = deps(5, { PUBLIC_BASE_URL: "https://asklens.com" });
    const manual = await createRiskCheck(rt, {
      kind: "manual",
      text: `buy ${FIXTURES.safe.mint}`,
    });
    expect(manual.ok).toBe(true);
    if (!manual.ok) return;
    expect(manual.check.replyText).not.toMatch(/https?:\/\//);
    const outbound = await publishOutbound(rt, FIXTURES.safe.mint);
    expect(outbound.ok).toBe(true);
    if (!outbound.ok) return;
    expect(outbound.check.replyText).not.toMatch(/https?:\/\//);
  });

  it("scores a proved call after the window", async () => {
    const { rt, provider, store } = deps();
    const posted = await publishOutbound(rt, FIXTURES.safe.mint);
    expect(posted.ok).toBe(true);
    if (!posted.ok) return;
    expect(posted.check.kind).toBe("call");
    expect(posted.check.riskLevel).toBe("LOW");
    provider.setPrice(FIXTURES.safe.mint, FIXTURES.safe.priceAfterWindow);
    const scored = await scoreDueChecks(rt, { windowDays: 0 });
    expect(scored).toBe(1);
    const check = await store.getCheck(posted.check.id);
    expect(check?.outcome?.callResult).toBe("win");
    expect(check?.outcome?.labelCorrect).toBe(true);
  });
});

async function captureLogs(run: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const original = console.log;
  console.log = (line?: unknown) => {
    lines.push(String(line));
  };
  try {
    await run();
    return lines;
  } finally {
    console.log = original;
  }
}

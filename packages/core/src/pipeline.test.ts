import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { FIXTURES } from "./providers/mock.js";
import { MockTokenDataProvider } from "./providers/mock.js";
import { createReplyWriter } from "./reply/writer.js";
import { hashReply } from "./proof/hash.js";
import { createMockProofPublisher } from "./proof/mock.js";
import { verifyPostedText } from "./proof/verify.js";
import { MemoryStore } from "./store/memory.js";
import { processMention, publishOutbound, type LensDeps } from "./pipeline.js";
import { scoreDueChecks } from "./outcomes.js";
import { MockXClient } from "./x/mock.js";
import type { XPost } from "./x/types.js";

function deps(rateLimit = 5): { rt: LensDeps; x: MockXClient; provider: MockTokenDataProvider; store: MemoryStore } {
  const store = new MemoryStore();
  const provider = new MockTokenDataProvider();
  const x = new MockXClient();
  const config = loadConfig({
    DATA_MODE: "mock",
    PROOF_MODE: "mock",
    LLM_MODE: "template",
    PUBLIC_BASE_URL: "http://127.0.0.1:3847",
    RATE_LIMIT_PER_USER_PER_DAY: String(rateLimit),
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
    expect(result.replyText.endsWith("Not financial advice.")).toBe(true);
    expect(result.replyText).toMatch(/claims do not match/i);
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

import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { FIXTURES, MockTokenDataProvider } from "./providers/mock.js";
import { publishOutbound, type LensDeps } from "./pipeline.js";
import { createMockProofPublisher } from "./proof/mock.js";
import { createReplyWriter } from "./reply/writer.js";
import { MemoryStore } from "./store/memory.js";
import { MockXClient } from "./x/mock.js";
import { queueWarningAlerts, warningAlertText } from "./alerts.js";

function deps(): LensDeps & { x: MockXClient; store: MemoryStore } {
  const store = new MemoryStore();
  const x = new MockXClient();
  const config = loadConfig({
    DATA_MODE: "mock",
    PROOF_MODE: "mock",
    LLM_MODE: "template",
    PUBLIC_BASE_URL: "http://127.0.0.1:3847",
  });
  return {
    config,
    store,
    provider: new MockTokenDataProvider(),
    proofs: createMockProofPublisher(store),
    writer: createReplyWriter(config),
    x,
  };
}

describe("warning DMs", () => {
  it("DMs a Pro watcher and skips a free watcher", async () => {
    const rt = deps();
    const pro = await rt.store.upsertUser({ xHandle: "pro_user", xUserId: "111", wallet: "w1" });
    await rt.store.setProUntil(pro.id, "2099-01-01T00:00:00.000Z");
    await rt.store.addWatch(pro.id, FIXTURES.danger.mint, "DANGER");
    const free = await rt.store.upsertUser({ xHandle: "free_user", xUserId: "222" });
    await rt.store.addWatch(free.id, FIXTURES.danger.mint, "DANGER");

    const posted = await publishOutbound(rt, FIXTURES.danger.mint);
    expect(posted.ok).toBe(true);
    if (!posted.ok) return;
    expect(rt.x.dms).toHaveLength(1);
    expect(rt.x.dms[0]?.recipientId).toBe("111");
    expect(rt.x.dms[0]?.text).toBe(warningAlertText(posted.check, rt.config.publicBaseUrl));
    expect(rt.x.dms[0]?.text).toContain("5bSU…Ggko");
    expect(rt.x.dms[0]?.text).not.toContain("Full report");
    expect(rt.x.dms[0]?.text).not.toMatch(/https?:\/\//);
    expect(rt.x.timeline[0]?.text).not.toMatch(/https?:\/\//);
    expect(rt.x.timeline[0]?.text).toContain("5bSU…Ggko");
    expect(rt.x.timeline[0]?.text).not.toContain("Full report");
    expect(rt.x.dms[0]?.text).not.toMatch(/scam/i);
    expect(rt.x.dms[0]?.text.endsWith("Not financial advice.")).toBe(true);
  });

  it("queues the DM until an X user id is known", async () => {
    const rt = deps();
    const pro = await rt.store.upsertUser({ xHandle: "pro_user", wallet: "w1" });
    await rt.store.setProUntil(pro.id, "2099-01-01T00:00:00.000Z");
    await rt.store.addWatch(pro.id, FIXTURES.danger.mint, "DANGER");
    const posted = await publishOutbound(rt, FIXTURES.danger.mint);
    expect(posted.ok).toBe(true);
    expect(rt.x.dms).toHaveLength(0);
    const queued = await rt.store.listAlertsByStatus("queued");
    expect(queued).toHaveLength(1);
  });

  it("sends one warning DM per watcher per mint per day", async () => {
    const rt = deps();
    const pro = await rt.store.upsertUser({ xHandle: "pro_user", xUserId: "111", wallet: "w1" });
    await rt.store.setProUntil(pro.id, "2099-01-01T00:00:00.000Z");
    await rt.store.addWatch(pro.id, FIXTURES.danger.mint, "DANGER");
    const posted = await publishOutbound(rt, FIXTURES.danger.mint);
    expect(posted.ok).toBe(true);
    if (!posted.ok) return;
    await queueWarningAlerts(rt, { ...posted.check, id: "second-check" });
    expect(rt.x.dms).toHaveLength(1);
  });
});

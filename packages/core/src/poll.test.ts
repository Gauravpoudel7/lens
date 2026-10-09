import { describe, expect, it } from "vitest";
import type { LensDeps } from "./pipeline.js";
import { runPollLoop } from "./poll.js";

describe("poll loop", () => {
  it("keeps going after a failed run and does not overlap polls", async () => {
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const controller = new AbortController();
    await runPollLoop({} as LensDeps, 5, {
      signal: controller.signal,
      sleep: async () => {},
      poll: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        calls += 1;
        if (calls === 1) {
          active -= 1;
          throw new Error("first run failed");
        }
        await new Promise((resolve) => setTimeout(resolve, 15));
        active -= 1;
        if (calls >= 2) controller.abort();
      },
    });
    expect(calls).toBe(2);
    expect(maxActive).toBe(1);
  });
});

describe("poll with editorial posts", () => {
  it("still replies to mentions when the editorial cycle throws", async () => {
    const { loadConfig } = await import("./config.js");
    const { MemoryStore } = await import("./store/memory.js");
    const { MockTokenDataProvider, FIXTURES } = await import("./providers/mock.js");
    const { MockXClient } = await import("./x/mock.js");
    const { createMockProofPublisher } = await import("./proof/mock.js");
    const { createReplyWriter } = await import("./reply/writer.js");
    const { pollOnce } = await import("./poll.js");
    const config = loadConfig({
      DATA_MODE: "mock",
      PROOF_MODE: "mock",
      X_MODE: "live",
      LLM_MODE: "template",
      EDITORIAL_ENABLED: "true",
    });
    const store = new MemoryStore();
    store.listEditorial = async () => {
      throw new Error("editorial table missing");
    };
    const x = new MockXClient();
    x.seed({
      id: "100",
      authorId: "u1",
      authorUsername: "asker",
      text: `@justasklens check ${FIXTURES.safe.mint}`,
      parentId: null,
      createdAt: "2026-10-09T12:00:00.000Z",
    });
    const deps: LensDeps = {
      config,
      store,
      provider: new MockTokenDataProvider(),
      proofs: createMockProofPublisher(store),
      writer: createReplyWriter(config),
      x,
    };
    const result = await pollOnce(deps);
    expect(result.replied).toBe(1);
    expect(x.replies).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { MemoryStore } from "../store/memory.js";
import { BOT_USER_CURSOR, resolveBotUserId } from "./bot-user.js";

describe("resolveBotUserId", () => {
  it("uses X_BOT_USER_ID and does not call users/me", async () => {
    const store = new MemoryStore();
    let calls = 0;
    const id = await resolveBotUserId({
      envUserId: "123",
      store,
      fetchMe: async () => {
        calls += 1;
        return "999";
      },
    });
    expect(id).toBe("123");
    expect(calls).toBe(0);
    expect(await store.getCursor(BOT_USER_CURSOR)).toBeNull();
  });

  it("reuses the database id and logs a hint", async () => {
    const store = new MemoryStore();
    await store.setCursor(BOT_USER_CURSOR, "555");
    const hints: string[] = [];
    let calls = 0;
    const id = await resolveBotUserId({
      store,
      fetchMe: async () => {
        calls += 1;
        return "999";
      },
      logHint: (message) => hints.push(message),
    });
    expect(id).toBe("555");
    expect(calls).toBe(0);
    expect(hints).toEqual(["Set X_BOT_USER_ID=555 so the next start does not call /2/users/me."]);
  });

  it("calls users/me once, caches the id, and skips the call next time", async () => {
    const store = new MemoryStore();
    const hints: string[] = [];
    let calls = 0;
    const id = await resolveBotUserId({
      store,
      fetchMe: async () => {
        calls += 1;
        return "777";
      },
      logHint: (message) => hints.push(message),
    });
    expect(id).toBe("777");
    expect(calls).toBe(1);
    expect(await store.getCursor(BOT_USER_CURSOR)).toBe("777");
    expect(hints[0]).toContain("X_BOT_USER_ID=777");

    const again = await resolveBotUserId({
      store,
      fetchMe: async () => {
        calls += 1;
        return "nope";
      },
      logHint: () => {},
    });
    expect(again).toBe("777");
    expect(calls).toBe(1);
  });
});

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

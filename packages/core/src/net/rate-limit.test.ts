import { describe, expect, it } from "vitest";
import { createRateLimiter, trustedClientIp } from "./rate-limit.js";

describe("client rate limit", () => {
  it("trusts Railway X-Real-IP and ignores a spoofed forwarded header", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.2.3.4, 10.0.0.8",
      "x-real-ip": "203.0.113.9",
    });
    expect(trustedClientIp(headers)).toBe("203.0.113.9");
    expect(trustedClientIp(new Headers())).toBe("local");
  });

  it("stops a key after the limit and forgets the oldest keys", () => {
    const allow = createRateLimiter(2);
    expect(allow("a", 1, 1_000, 0)).toBe(true);
    expect(allow("a", 1, 1_000, 10)).toBe(false);
    expect(allow("b", 1, 1_000, 20)).toBe(true);
    expect(allow("c", 1, 1_000, 30)).toBe(true);
    expect(allow("a", 1, 1_000, 40)).toBe(true);
  });
});

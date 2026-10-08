import { describe, expect, it } from "vitest";
import { SESSION_TTL_MS, signSession, verifySession } from "./session.js";
import { createNonceStore } from "./wallet-proof.js";

const wallet = "6bzZwnSvBLur1xr9baRyHZ3Ck4GgiUCUZf8YQ3oXBEm5";
const other = "So11111111111111111111111111111111111111112";
const secret = "test-secret";

describe("wallet session token", () => {
  it("returns the wallet until it expires", () => {
    const now = 1_800_000_000_000;
    const { token, expiresAt } = signSession(wallet, secret, now);
    expect(expiresAt).toBe(now + SESSION_TTL_MS);
    expect(verifySession(token, secret, now + 1000)).toBe(wallet);
    expect(verifySession(token, secret, expiresAt)).toBeNull();
  });

  it("rejects a wrong secret, a swapped wallet, a moved expiry, and junk", () => {
    const now = 1_800_000_000_000;
    const { token } = signSession(wallet, secret, now);
    expect(verifySession(token, "other-secret", now)).toBeNull();
    expect(verifySession(token.replace(wallet, other), secret, now)).toBeNull();
    const [v, w, exp, mac] = token.split(".");
    expect(verifySession([v, w, String(Number(exp) + 1), mac].join("."), secret, now)).toBeNull();
    expect(verifySession("v1.x.y", secret, now)).toBeNull();
    expect(verifySession("", secret, now)).toBeNull();
    expect(verifySession(null, secret, now)).toBeNull();
  });
});

describe("nonce store", () => {
  it("forgets a consumed nonce so a signature cannot be replayed", () => {
    const store = createNonceStore();
    const issued = store.issue(wallet, 1000);
    expect(store.matches(issued.nonce, wallet, issued.expiresAt, 2000)).toBe(true);
    store.consume(issued.nonce);
    expect(store.matches(issued.nonce, wallet, issued.expiresAt, 2000)).toBe(false);
  });
});

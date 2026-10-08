import { describe, expect, it } from "vitest";
import { sameOrigin } from "./wallet-session";

describe("sameOrigin", () => {
  it("accepts this site and refuses another", () => {
    expect(sameOrigin(new Headers({ origin: "http://127.0.0.1:3847", host: "127.0.0.1:3847" }))).toBe(true);
    expect(sameOrigin(new Headers({ origin: "https://evil.example", host: "127.0.0.1:3847" }))).toBe(false);
    expect(sameOrigin(new Headers({ origin: "null", host: "127.0.0.1:3847" }))).toBe(false);
    expect(sameOrigin(new Headers({ host: "127.0.0.1:3847" }))).toBe(true);
  });
});

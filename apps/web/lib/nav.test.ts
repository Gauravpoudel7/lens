import { describe, expect, it } from "vitest";
import { NAV, isCurrent } from "./nav";

describe("record route", () => {
  it("points the Record nav item at /record", () => {
    expect(NAV.find((item) => item.label === "Record")?.href).toBe("/record");
  });

  it("marks the record and a report as the Record section", () => {
    expect(isCurrent("/record", "/record")).toBe(true);
    expect(isCurrent("/r/abc", "/record")).toBe(true);
    expect(isCurrent("/", "/record")).toBe(false);
    expect(isCurrent("/check", "/record")).toBe(false);
  });

  it("still marks the other sections from their own paths", () => {
    expect(isCurrent("/check", "/check")).toBe(true);
    expect(isCurrent("/pro", "/pro")).toBe(true);
    expect(isCurrent("/updates", "/updates")).toBe(true);
    expect(isCurrent("/account", "/updates")).toBe(false);
  });

  it("keeps Verified coins and proof Verify apart", () => {
    expect(isCurrent("/verified", "/verified")).toBe(true);
    expect(isCurrent("/verified/abc", "/verified")).toBe(true);
    expect(isCurrent("/verified", "/verify")).toBe(false);
    expect(isCurrent("/verify", "/verified")).toBe(false);
  });
});

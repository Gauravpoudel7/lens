import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { dueEditorial } from "./schedule.js";
import { editorialFixture } from "./testing.js";

const config = loadConfig({});
const at = (iso: string) => new Date(iso);

describe("editorial schedule", () => {
  it("is quiet before the first slot", () => {
    expect(dueEditorial(at("2026-10-09T12:59:00Z"), config, [])).toBeNull();
  });

  it("returns one kind per poll, earliest slot first", () => {
    expect(dueEditorial(at("2026-10-09T17:30:00Z"), config, [])).toBe("tip");
    const tipDone = [editorialFixture({ kind: "tip" })];
    expect(dueEditorial(at("2026-10-09T17:30:00Z"), config, tipDone)).toBe("recap");
  });

  it("treats a record in any status as done for the day, and ignores other days", () => {
    expect(dueEditorial(at("2026-10-09T13:05:00Z"), config, [editorialFixture({ status: "skipped" })])).toBeNull();
    expect(dueEditorial(at("2026-10-09T13:05:00Z"), config, [editorialFixture({ day: "2026-10-08" })])).toBe("tip");
  });

  it("skips a slot more than EDITORIAL_MAX_LATE_HOURS late", () => {
    expect(dueEditorial(at("2026-10-09T19:00:00Z"), config, [])).toBe("tip");
    expect(dueEditorial(at("2026-10-09T19:01:00Z"), config, [editorialFixture({ kind: "recap", id: "r" })])).toBeNull();
    expect(dueEditorial(at("2026-10-09T19:01:00Z"), config, [])).toBe("recap");
  });

  it("only offers enabled kinds", () => {
    const termsOnly = loadConfig({ EDITORIAL_KINDS: "term" });
    expect(dueEditorial(at("2026-10-09T17:30:00Z"), termsOnly, [])).toBeNull();
    expect(dueEditorial(at("2026-10-09T22:10:00Z"), termsOnly, [])).toBe("term");
  });
});

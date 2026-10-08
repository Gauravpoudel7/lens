import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { createReplyWriter } from "./writer.js";

describe("reply writer", () => {
  it("does not post a third-party symbol, mention, or URL when policy would fail", async () => {
    const writer = createReplyWriter(
      loadConfig({ LLM_MODE: "template", PUBLIC_BASE_URL: "http://127.0.0.1:3847" }),
    );
    const written = await writer.write({
      riskLevel: "HIGH",
      symbol: "LOW https://evil.example/x",
      name: "@elonmusk",
      mint: "6bzZwnSvBLur1xr9baRyHZ3Ck4GgiUCUZf8YQ3oXBEm5",
      reportUrl: "http://127.0.0.1:3847/r/abc",
      facts: [
        {
          id: "injected",
          signal: "danger",
          text: "see https://evil.example/phish @bob #tag",
          short: "LOW see https://evil.example/phish",
          sourceUrl: null,
          sourceLabel: null,
        },
      ],
    });
    expect(written.text).not.toMatch(/https?:\/\//);
    expect(written.text).not.toMatch(/@/);
    expect(written.text).not.toMatch(/#/);
    expect(written.text).toContain("HIGH");
    expect(written.text).not.toMatch(/\bLOW\b/);
    expect(written.text.endsWith("Not financial advice.")).toBe(true);
  });
});

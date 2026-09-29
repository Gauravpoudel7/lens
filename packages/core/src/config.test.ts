import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { jupiterApiKeyHeader } from "./providers/jupiter.js";

describe("loadConfig product defaults", () => {
  it("keeps X replies link-free, polls every 180 seconds, and uses api.jup.ag", () => {
    const config = loadConfig({});
    expect(config.xReplyLinks).toBe(false);
    expect(config.pollIntervalMs).toBe(180_000);
    expect(config.jupiterBaseUrl).toBe("https://api.jup.ag");
    expect(config.jupiterApiKey).toBeUndefined();
    expect(jupiterApiKeyHeader(config.jupiterApiKey)).toEqual({});
  });

  it("turns links and the Jupiter key on when the env says so", () => {
    const config = loadConfig({
      X_REPLY_LINKS: "true",
      POLL_INTERVAL_MS: "90000",
      JUPITER_BASE_URL: "https://example.jup.ag/",
      JUPITER_API_KEY: " test-key ",
    });
    expect(config.xReplyLinks).toBe(true);
    expect(config.pollIntervalMs).toBe(90_000);
    expect(config.jupiterBaseUrl).toBe("https://example.jup.ag");
    expect(config.jupiterApiKey).toBe("test-key");
    expect(jupiterApiKeyHeader(config.jupiterApiKey)).toEqual({ "x-api-key": "test-key" });
  });
});

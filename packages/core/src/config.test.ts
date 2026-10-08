import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { jupiterApiKeyHeader } from "./providers/jupiter.js";

describe("loadConfig product defaults", () => {
  it("keeps X replies link-free, polls every 180 seconds, and uses api.jup.ag", () => {
    const config = loadConfig({});
    expect(config.xReplyLinks).toBe(false);
    expect(config.xSwapLinksOnRequest).toBe(true);
    expect(config.publicSiteName).toBeUndefined();
    expect(config.pollIntervalMs).toBe(180_000);
    expect(config.jupiterBaseUrl).toBe("https://api.jup.ag");
    expect(config.jupiterApiKey).toBeUndefined();
    expect(config.maxXRepliesPerDay).toBe(50);
    expect(config.proPriceUsdc).toBe(10);
    expect(config.proPeriodDays).toBe(30);
    expect(config.proCheckoutTtlHours).toBe(24);
    expect(jupiterApiKeyHeader(config.jupiterApiKey)).toEqual({});
  });

  it("turns links and the Jupiter key on when the env says so", () => {
    const config = loadConfig({
      X_REPLY_LINKS: "true",
      X_SWAP_LINKS_ON_REQUEST: "false",
      PUBLIC_SITE_NAME: " asklens.xyz ",
      POLL_INTERVAL_MS: "90000",
      JUPITER_BASE_URL: "https://example.jup.ag/",
      JUPITER_API_KEY: " test-key ",
    });
    expect(config.xReplyLinks).toBe(true);
    expect(config.xSwapLinksOnRequest).toBe(false);
    expect(config.publicSiteName).toBe("asklens.xyz");
    expect(config.pollIntervalMs).toBe(90_000);
    expect(config.jupiterBaseUrl).toBe("https://example.jup.ag");
    expect(config.jupiterApiKey).toBe("test-key");
    expect(jupiterApiKeyHeader(config.jupiterApiKey)).toEqual({ "x-api-key": "test-key" });
  });
});

describe("loadConfig handle, caps, and session", () => {
  it("defaults the handle and DM caps and reads overrides", () => {
    const base = loadConfig({});
    expect(base.xBotHandle).toBe("justasklens");
    expect(base.alertDmsPerUserPerDay).toBe(10);
    expect(base.alertDmsPerDay).toBe(100);
    expect(base.sessionSecret).toBeUndefined();
    const set = loadConfig({
      X_BOT_HANDLE: "@otherbot",
      ALERT_DMS_PER_USER_PER_DAY: "3",
      ALERT_DMS_PER_DAY: "20",
      LENS_SESSION_SECRET: " s3cret ",
    });
    expect(set.xBotHandle).toBe("otherbot");
    expect(set.alertDmsPerUserPerDay).toBe(3);
    expect(set.alertDmsPerDay).toBe(20);
    expect(set.sessionSecret).toBe("s3cret");
  });
});

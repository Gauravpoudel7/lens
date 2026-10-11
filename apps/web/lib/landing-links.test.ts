import { describe, expect, it } from "vitest";
import { landingCopy } from "@/content/landing/copy";
import { LANDING_APP_LINKS } from "./landing-links";

describe("landing links", () => {
  it("uses in-app paths, with the record at /record", () => {
    expect(LANDING_APP_LINKS.record).toBe("/record");
    for (const href of Object.values(LANDING_APP_LINKS)) {
      expect(href.startsWith("/")).toBe(true);
      expect(href.includes("://")).toBe(false);
    }
  });

  it("fills the handle and the free-check count into the copy", () => {
    const copy = landingCopy({
      handle: "justasklens",
      freeChecksPerDay: 5,
      proPriceUsdc: 10,
      proPeriodDays: 30,
      swapFeeBps: 50,
      proofCluster: "Devnet",
      githubUrl: null,
    });
    expect(copy.HANDLE).toBe("@justasklens");
    expect(copy.HERO.sub).toContain("@justasklens");
    expect(copy.HERO.titleLines).toHaveLength(4);
    expect(copy.STEPS[1]).toBe("You tag @justasklens");
    expect(copy.REAL_STATS.find((stat) => stat.label === "Free checks a day")?.value).toBe(5);
    expect(copy.PRICING.plans[1]?.price).toBe("10 USDC");
    expect(copy.PRICING.plans[2]?.cta.kind).toBe("record");
  });
});

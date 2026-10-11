import { cache } from "react";
import { landingCopy, type LandingFacts } from "@/content/landing/copy";
import { publicConfig } from "@/lib/public-config";

/** Handle, price, and caps from the same config as the rest of the site. */
export const getLandingCopy = cache(async () => {
  const config = await publicConfig();
  const facts: LandingFacts = {
    handle: config.xBotHandle.replace(/^@/, ""),
    freeChecksPerDay: config.rateLimitPerUserPerDay,
    proPriceUsdc: config.proPriceUsdc,
    proPeriodDays: config.proPeriodDays,
    swapFeeBps: config.jupiterFeeBps,
    proofCluster: config.solanaCluster === "mainnet-beta" ? "Mainnet" : "Devnet",
    githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL?.trim() || null,
  };
  return {
    facts,
    copy: landingCopy(facts),
    xUrl: `https://x.com/${facts.handle}`,
  };
});

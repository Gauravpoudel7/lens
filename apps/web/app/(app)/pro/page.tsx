import { PageShell, SideCard } from "@/components/page-shell";
import { formatUsdc } from "@/lib/format";
import { publicConfig } from "@/lib/public-config";
import { ProPanel } from "./pro-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pro",
};

export default async function ProPage() {
  const config = await publicConfig();
  const price = formatUsdc(config.proPriceUsdc);

  return (
    <PageShell
      title="Go Pro"
      lede="No daily limit on X, and a DM when a token you watch turns HIGH."
      aside={
        <>
          <SideCard title={`${price} USDC for ${config.proPeriodDays} days`}>
            <ul className="space-y-2">
              <li>No personal daily limit on X (free is {config.rateLimitPerUserPerDay} a day).</li>
              <li>A DM when a token on your watchlist is rated HIGH.</li>
              <li>The same risk rules. Paying never changes a rating.</li>
            </ul>
          </SideCard>
          <SideCard title="How it works">
            <ol className="list-inside list-decimal space-y-2">
              <li>Pay USDC from your wallet. Lens never holds it.</li>
              <li>Sign in on your account page.</li>
              <li>DM the code you see there to @{config.xBotHandle} to link X.</li>
            </ol>
          </SideCard>
        </>
      }
    >
      <ProPanel
        priceUsd={config.proPriceUsdc}
        periodDays={config.proPeriodDays}
        treasurySet={Boolean(config.proTreasury) && config.proPriceUsdc > 0}
        ttlHours={config.proCheckoutTtlHours}
      />
    </PageShell>
  );
}

import { PageHeader } from "@/components/page-header";
import { publicConfig } from "@/lib/public-config";
import { AccountPanel } from "./account-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string; wallet?: string }>;
}) {
  const params = await searchParams;
  const config = await publicConfig();

  return (
    <main className="max-w-2xl py-10 sm:py-14">
      <PageHeader
        kicker="Account"
        title="Plan, expiry, and watchlist."
        lede="Look up a plan with the X handle or the wallet that paid. There is no password. Lens does not hold a balance for you."
      />
      <AccountPanel
        initialHandle={params.handle ?? ""}
        initialWallet={params.wallet ?? ""}
        priceUsd={config.proPriceUsdc}
        periodDays={config.proPeriodDays}
      />
    </main>
  );
}

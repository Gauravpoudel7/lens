import { PageShell } from "@/components/page-shell";
import { publicConfig } from "@/lib/public-config";
import { sessionWallet } from "@/lib/wallet-session";
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
  const signedIn = await sessionWallet().catch(() => null);

  return (
    <PageShell title="Your account" lede="Sign in with the wallet that paid. No password.">
      <AccountPanel
        signedIn={signedIn}
        initialHandle={params.handle ?? ""}
        initialWallet={params.wallet ?? ""}
        priceUsd={config.proPriceUsdc}
        periodDays={config.proPeriodDays}
        botHandle={config.xBotHandle}
      />
    </PageShell>
  );
}

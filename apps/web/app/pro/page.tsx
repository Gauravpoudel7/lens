import { getRuntime } from "@/lib/runtime";
import { ProPanel } from "./pro-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pro alerts",
};

export default async function ProPage() {
  let priceUsd = 10;
  let periodDays = 30;
  let treasurySet = false;
  let usdcMint = "";
  try {
    const rt = await getRuntime();
    priceUsd = rt.config.proPriceUsdc;
    periodDays = rt.config.proPeriodDays;
    treasurySet = Boolean(rt.config.proTreasury);
    usdcMint = rt.config.usdcMint;
  } catch {
    treasurySet = false;
  }

  return (
    <main className="max-w-2xl py-8">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Pro</p>
      <h1 className="mt-2 font-serif text-4xl">Alerts when a watched token is HIGH.</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Free mentions stay on the daily cap. Pro removes that cap for the X account you register, and Lens DMs you
        when a watched mint is HIGH. Payment is a USDC transfer on Solana. Lens checks the transfer on-chain before
        it flips the account to Pro. The risk rules do not change.
      </p>
      <ProPanel priceUsd={priceUsd} periodDays={periodDays} treasurySet={treasurySet} usdcMint={usdcMint} />
    </main>
  );
}

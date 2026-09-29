import { Check, ShieldAlert } from "lucide-react";
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
    <main className="py-10 sm:py-14">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Pro</p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight">Alerts when a watched token is HIGH.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
        Free mentions stay on the daily cap. Pro removes that cap for the X account you register, and Lens DMs you
        when a watched mint is HIGH. Payment is a USDC transfer on Solana. Lens checks the transfer on-chain before
        it flips the account to Pro. The risk rules do not change.
      </p>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-3xl border border-emerald-400/30 bg-gradient-to-b from-emerald-400/10 to-white/[0.02] p-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Pricing</p>
          <p className="mt-4 flex items-end gap-2">
            <span className="text-5xl font-semibold tracking-tight">${priceUsd.toFixed(0)}</span>
            <span className="mb-1 text-sm text-zinc-400">USDC / {periodDays} days</span>
          </p>
          <ul className="mt-6 space-y-3 text-sm text-zinc-200">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
              No daily mention cap for the registered X account
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
              DM when a watched mint comes back HIGH
            </li>
            <li className="flex gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
              Same published risk rules as a free check
            </li>
          </ul>
          <p className="mt-6 text-xs leading-5 text-zinc-500">
            Paid in USDC via Solana Pay. Card checkout is a separate rail and is not turned on.
          </p>
        </section>
        <ProPanel priceUsd={priceUsd} periodDays={periodDays} treasurySet={treasurySet} usdcMint={usdcMint} />
      </div>
    </main>
  );
}

import { FIXTURES } from "@lens/core";
import { ModeBanner } from "@/components/mode-banner";
import { getRuntime } from "@/lib/runtime";
import { CheckForm } from "./check-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Run a check",
};

export default async function CheckPage() {
  let dataMode = "mock";
  let proofMode = "mock";
  try {
    const rt = await getRuntime();
    dataMode = rt.config.dataMode;
    proofMode = rt.config.proofMode;
  } catch {
    dataMode = "mock";
    proofMode = "mock";
  }

  return (
    <main className="max-w-2xl py-10 sm:py-14">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Manual check</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Same rules the bot uses.</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">
        Paste a contract address, a $ticker, or the text of a promo. Lens resolves the token, scores it with fixed
        rules, writes the reply, and stores a proof before the report opens. The result is added to the public
        record. Free checks are rate-limited per hour.
      </p>
      <ModeBanner dataMode={dataMode} proofMode={proofMode} />
      <CheckForm
        examples={[
          {
            label: "$DANGER fixture",
            value: `Just aped $DANGER. CA: ${FIXTURES.danger.mint} LP locked and burned`,
          },
          { label: "$SAFE fixture", value: `$${FIXTURES.safe.symbol} ${FIXTURES.safe.mint}` },
          { label: "$MID fixture", value: FIXTURES.mid.mint },
        ]}
      />
    </main>
  );
}

import { FIXTURES } from "@lens/core";
import { PageHeader } from "@/components/page-header";
import { publicConfig } from "@/lib/public-config";
import { CheckForm } from "./check-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Run a check",
};

export default async function CheckPage() {
  const config = await publicConfig();

  return (
    <main className="max-w-2xl py-10 sm:py-14">
      <PageHeader
        kicker="Check"
        title="Same rules the bot uses."
        lede="Paste a mint, a $ticker, or the text of a post. Lens scores it, writes the reply, and stores the proof before the report opens. The result joins the public record."
      />
      <p className="mt-4 max-w-2xl text-sm leading-6 text-faint">
        Free checks from one IP are limited to {config.checkApiLimitPerHour} an hour. A Pro wallet on the form skips
        that limit. On X, free accounts get {config.rateLimitPerUserPerDay} replies a day.
      </p>
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

import Link from "next/link";
import { errorMessage, logError, verifiedView, type CheckRecord, type VerifiedListingRecord } from "@lens/core";
import { ModeNotice } from "@/components/mode-notice";
import { PageShell, SideCard } from "@/components/page-shell";
import { RiskStamp } from "@/components/risk-stamp";
import { formatUsdc, shortMint } from "@/lib/format";
import { getRuntime } from "@/lib/runtime";
import { CheckedBadge } from "./checked-badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Verified" };

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

type Row = { listing: VerifiedListingRecord; check: CheckRecord | null };

export default async function VerifiedListPage() {
  let rows: Row[] = [];
  let price = 0;
  let days = 30;
  let failed = false;
  try {
    const rt = await getRuntime();
    price = rt.config.verifiedPriceUsdc;
    days = rt.config.verifiedPeriodDays;
    const listings = await rt.store.listActiveVerified(new Date());
    // Read-only: the list never runs a new check. Each coin's own page does that.
    rows = await Promise.all(
      listings.map(async (listing) => ({ listing, check: await rt.store.latestCheckForMint(listing.mint, YEAR_MS) })),
    );
  } catch (err) {
    logError("verified list failed", { detail: errorMessage(err) });
    failed = true;
  }

  return (
    <PageShell
      title="Lens Verified"
      lede="Coin teams pay for a page with their own links. The rating next to each coin comes from the same rules as every other check."
      aside={
        <>
          <SideCard title="What Verified means">
            <ul className="space-y-2">
              <li>The token’s creator wallet paid {formatUsdc(price)} USDC for {days} days.</li>
              <li>Team links are provided by the team. Lens did not check them.</li>
              <li>Paying never changes a rating. A HIGH coin stays HIGH.</li>
              <li>“Checked by Lens” shows only while a check from the last 15 minutes is LOW.</li>
            </ul>
          </SideCard>
          <SideCard title="For teams">
            Open <span className="font-mono text-sm">/verified/&lt;mint&gt;</span> for your token and pay from the
            wallet that created it.
          </SideCard>
        </>
      }
    >
      <ModeNotice />
      {failed ? (
        <p className="text-lg text-muted">The list did not load. Try again in a minute.</p>
      ) : rows.length === 0 ? (
        <p className="text-lg text-muted">No coins have an active Verified page yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-panel">
          {rows.map(({ listing, check }) => {
            const view = verifiedView(listing, check);
            return (
              <li key={listing.mint}>
                <Link
                  href={`/verified/${listing.mint}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-line/20"
                >
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold text-ink">${check?.tokenSymbol ?? "TOKEN"}</span>
                    <span className="font-mono text-sm text-faint">{shortMint(listing.mint)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {view.badge ? <CheckedBadge mock={view.mock} /> : null}
                    {view.fresh ? (
                      <RiskStamp level={view.level} compact />
                    ) : (
                      <span className="text-base text-muted">Not checked recently</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}

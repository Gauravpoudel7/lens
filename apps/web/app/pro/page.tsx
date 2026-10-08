import Link from "next/link";
import { PageHeader } from "@/components/page-header";
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
  const days = config.proPeriodDays;
  const freeDaily = config.rateLimitPerUserPerDay;
  const botCap = config.maxXRepliesPerDay;
  const hourly = config.checkApiLimitPerHour;
  const ttl = config.proCheckoutTtlHours;

  return (
    <main className="py-10 sm:py-14">
      <PageHeader
        kicker="Pro"
        title="Alerts when a coin you watch is high risk."
        lede="Free checks on X stop at a daily cap. Pro removes that cap for one X account and sends a DM when a watched mint comes back HIGH. The risk rules do not change."
      >
        <a
          href="#checkout"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink"
        >
          Pay {price} USDC
        </a>
      </PageHeader>

      <section className="rise mt-10" style={{ animationDelay: "80ms" }}>
        <h2 className="font-serif text-3xl tracking-tight">Free and Pro</h2>
        <div className="mt-4 grid gap-3 md:hidden">
          <PlanSummary
            name="Free"
            rows={[
              ["Price", "$0"],
              ["Checks on X", `${freeDaily} a day for your account`],
              ["Checks on this site", `${hourly} an hour per IP`],
              ["Watchlist", "Not included"],
              ["Risk level", "The published rules"],
              ["Bot-wide limit", `${botCap} replies a day, shared`],
            ]}
          />
          <PlanSummary
            name="Pro"
            rows={[
              ["Price", `${price} USDC every ${days} days`],
              ["Checks on X", "No personal daily cap"],
              ["Checks on this site", `${hourly} an hour per IP`],
              ["Watchlist", "DM when a watched mint is HIGH"],
              ["Risk level", "The same rules. Paying does not change a level."],
              ["Bot-wide limit", "The same shared limit. Pro does not skip it."],
            ]}
          />
        </div>
        <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-line md:block">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Free and Pro plans</caption>
            <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-faint">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Item</span>
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Free
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-ink">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              <Row label="Price" free="$0" pro={`${price} USDC every ${days} days`} />
              <Row
                label="Checks on X"
                free={`${freeDaily} a day for your account`}
                pro="No personal daily cap"
              />
              <Row label="Checks on this site" free={`${hourly} an hour per IP`} pro={`${hourly} an hour per IP`} />
              <Row label="Watchlist" free="Not included" pro="DM when a watched mint is HIGH" />
              <Row label="Risk level" free="The published rules" pro="The same rules. Paying does not change a level." />
              <Row
                label="Bot-wide limit"
                free={`${botCap} replies a day, shared`}
                pro="The same shared limit. Pro does not skip it."
              />
            </tbody>
          </table>
        </div>
      </section>

      <section className="rise mt-12 max-w-2xl" style={{ animationDelay: "140ms" }}>
        <h2 className="font-serif text-3xl tracking-tight">How payment works</h2>
        <ol className="mt-4 space-y-4 text-sm leading-6 text-muted">
          <li>
            <span className="font-semibold text-ink">1. A one-time link.</span> Lens builds a Solana Pay request for
            exactly {price} USDC. The link includes a reference so this payment can be matched.
          </li>
          <li>
            <span className="font-semibold text-ink">2. You send it.</span> The USDC moves from your wallet to the
            treasury wallet. Lens never holds the funds, and it never asks you to deposit into a Lens account.
          </li>
          <li>
            <span className="font-semibold text-ink">3. Lens reads the chain.</span> Pro starts only after a confirmed
            transfer includes the reference and at least the price. An unpaid link expires after {ttl} hours. A short
            payment is rejected. A reference Lens never issued is reported as not found. A full transfer still confirms
            after the window.
          </li>
        </ol>
        <p className="mt-4 text-sm leading-6 text-faint">
          Card checkout is not turned on. There is no password.{" "}
          <Link href="/account" className="text-accent-text hover:text-ink">
            Open an account
          </Link>{" "}
          with the X handle or the wallet that paid.
        </p>
      </section>

      <section id="checkout" className="rise mt-12 scroll-mt-24" style={{ animationDelay: "180ms" }}>
        <h2 className="font-serif text-3xl tracking-tight">Pay with USDC</h2>
        <div className="mt-4 max-w-xl">
          <ProPanel
            priceUsd={config.proPriceUsdc}
            periodDays={days}
            treasurySet={Boolean(config.proTreasury)}
            usdcMint={config.usdcMint}
            ttlHours={ttl}
          />
        </div>
      </section>
    </main>
  );
}

function PlanSummary({ name, rows }: { name: string; rows: Array<[string, string]> }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <h3 className="font-serif text-2xl tracking-tight">{name}</h3>
      <dl className="mt-3 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-faint">{label}</dt>
            <dd className="text-sm leading-6">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Row({ label, free, pro }: { label: string; free: string; pro: string }) {
  return (
    <tr className="border-b border-line last:border-0">
      <th scope="row" className="px-4 py-3 text-left font-medium text-ink">
        {label}
      </th>
      <td className="px-4 py-3 text-muted">{free}</td>
      <td className="px-4 py-3 text-ink">{pro}</td>
    </tr>
  );
}

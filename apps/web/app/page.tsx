import Link from "next/link";
import { computeStats, type CheckRecord, type ScorecardStats } from "@lens/core";
import { CountUp } from "@/components/count-up";
import { RiskStamp } from "@/components/risk-stamp";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { formatTime, kindLabel, outcomeLabel, percentPoints, shortMint } from "@/lib/format";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "1",
    title: "Tag or paste",
    body: "Reply @justasklens under a Solana coin on X, or paste a mint or $ticker here.",
  },
  {
    n: "2",
    title: "Rules, then a reply",
    body: "Lens reads liquidity, holders, and authorities. The level comes from fixed rules.",
  },
  {
    n: "3",
    title: "Stamp, then publish",
    body: "The exact reply is hashed into a Solana memo before it is saved. Anyone can check that stamp.",
  },
];

export default async function HomePage() {
  let checks: CheckRecord[] = [];
  let stats: ScorecardStats | null = null;
  let windowDays = 7;
  let error: string | null = null;

  try {
    const rt = await getRuntime();
    windowDays = rt.config.outcomeWindowDays;
    checks = await rt.store.listChecks({ limit: 200 });
    stats = computeStats(checks, {
      windowDays: rt.config.outcomeWindowDays,
      sharpDropPct: rt.config.sharpDropPct,
      callWinPct: rt.config.callWinPct,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "The record could not be opened.";
  }

  if (error || !stats) {
    return (
      <main className="py-16">
        <h1 className="font-serif text-4xl tracking-tight">The record is not ready.</h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted">
          The public record could not be opened. Try again in a moment.
        </p>
      </main>
    );
  }

  return (
    <main className="py-10 sm:py-14">
      <section className="relative">
        <div className="ledger-grid pointer-events-none absolute inset-x-0 -top-6 h-56" aria-hidden="true" />
        <div className="relative">
          <p className="rise text-sm font-medium text-accent-text">Public record · @justasklens</p>
          <h1 className="rise mt-3 max-w-3xl font-serif text-4xl leading-[1.08] tracking-tight sm:text-6xl">
            Tag @justasklens under any Solana coin.
          </h1>
          <p className="rise mt-4 max-w-2xl text-lg leading-8 text-muted" style={{ animationDelay: "80ms" }}>
            Lens checks the risk, stamps the answer on Solana, and keeps a public track record. Low risk means no major
            red flags. It does not mean the price will rise.
          </p>
          <div className="rise" style={{ animationDelay: "140ms" }}>
            <SearchBox />
          </div>
        </div>
      </section>

      <section className="rise mt-16" style={{ animationDelay: "180ms" }}>
        <h2 className="text-sm font-medium text-faint">How a check works</h2>
        <ol className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="bg-panel px-5 py-5">
              <p className="font-mono text-sm text-accent-text">{step.n}</p>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rise mt-16" style={{ animationDelay: "220ms" }}>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-serif text-3xl tracking-tight">Track record</h2>
          <p className="text-sm text-faint">Window {stats.windowDays} days</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Recorded checks"
            value={stats.totalChecks}
            detail="Calls, warnings, and replies. Unresolved posts are left out."
          />
          <Stat
            label="Call win rate"
            value={percentPoints(stats.callWinRate)}
            suffix="%"
            decimals={1}
            detail={
              stats.callSample
                ? `${stats.callSample} scored call${stats.callSample === 1 ? "" : "s"} up at least ${stats.callWinPct}%`
                : `No scored calls yet. A win is a rise of at least ${stats.callWinPct}%.`
            }
          />
          <Stat
            label="Label accuracy"
            value={percentPoints(stats.labelAccuracy)}
            suffix="%"
            decimals={1}
            detail={
              stats.labelSample
                ? `${stats.labelSample} scored LOW and HIGH check${stats.labelSample === 1 ? "" : "s"}`
                : "No scored LOW or HIGH checks yet. MEDIUM is left out of this rate."
            }
          />
          <Stat
            label="How steady the calls were"
            value={stats.sharpe}
            decimals={2}
            detail={
              stats.sharpe == null
                ? "Needs two scored calls. Average return, divided by how much those returns vary."
                : "Average call return divided by how much those returns vary. Not a yearly figure."
            }
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-faint">
          HIGH that later dropped at least {Math.abs(stats.sharpDropPct)}%:{" "}
          {stats.highRiskSample ? `${stats.highRiskSample} scored` : "none scored yet"}. LOW that held above that drop:{" "}
          {stats.lowRiskSample ? `${stats.lowRiskSample} scored` : "none scored yet"}. Flats are not wins.
        </p>
      </section>

      <section className="rise mt-16" style={{ animationDelay: "260ms" }}>
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-serif text-3xl tracking-tight">Recent checks</h2>
          <Link href="/check" className="text-sm text-accent-text hover:text-ink">
            Run a check
          </Link>
        </div>
        {checks.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line px-5 py-10">
            <h3 className="font-serif text-2xl">No checks yet</h3>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
              Nothing has been recorded. Tag @justasklens under a coin, or run a check on this site. The rates above
              stay blank until a check is scored.
            </p>
            <Button asChild className="mt-5">
              <Link href="/check">Run a check</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line md:hidden">
            {checks.map((check) => (
              <li key={check.id}>
                <Link href={`/r/${check.id}`} className="block px-4 py-4 hover:bg-panel">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">${check.tokenSymbol}</span>
                    <RiskStamp level={check.riskLevel} />
                  </span>
                  <span className="mt-1 block font-mono text-xs text-faint">
                    {check.tokenMint ? shortMint(check.tokenMint) : "—"}
                  </span>
                  <span className="mt-1 block text-xs text-faint">
                    {formatTime(check.createdAt)} · {kindLabel(check.kind)}
                    {check.dataMode === "mock" ? " · mock" : ""}
                  </span>
                  <span className="mt-1 block text-sm text-muted">{outcomeLabel(check, windowDays)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {checks.length > 0 ? (
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-line md:block">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Recent Lens checks</caption>
              <thead className="border-b border-line text-xs uppercase tracking-[0.12em] text-faint">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    When
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Token
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Mint
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Level
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    After the window
                  </th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check) => (
                  <tr key={check.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-faint">{formatTime(check.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/r/${check.id}`} className="font-medium hover:text-accent-text">
                        ${check.tokenSymbol}
                      </Link>
                      <span className="mt-0.5 block text-xs text-faint">
                        {kindLabel(check.kind)}
                        {check.dataMode === "mock" ? " · mock" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {check.tokenMint ? shortMint(check.tokenMint) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <RiskStamp level={check.riskLevel} />
                    </td>
                    <td className="px-4 py-3 text-muted">{outcomeLabel(check, windowDays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  detail,
  suffix = "",
  decimals = 0,
}: {
  label: string;
  value: number | null;
  detail: string;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-4 py-4">
      <p className="text-sm text-faint">{label}</p>
      <p className="mt-2 font-serif text-4xl tracking-tight tabular-nums">
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </p>
      <p className="mt-2 text-sm leading-5 text-faint">{detail}</p>
    </div>
  );
}

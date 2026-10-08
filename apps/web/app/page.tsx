import Link from "next/link";
import {
  DEFAULTS,
  SCORECARD_KINDS,
  computeStats,
  errorMessage,
  logError,
  type CheckRecord,
  type ScorecardStats,
} from "@lens/core";
import { CountUp } from "@/components/count-up";
import { RiskStamp } from "@/components/risk-stamp";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { formatTime, kindLabel, outcomeLabel, percentPoints, shortMint } from "@/lib/format";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

function steps(handle: string) {
  return [
    { n: "1", title: "Ask", body: `Tag @${handle} under a token on X, or paste it here.` },
    { n: "2", title: "Check", body: "Fixed rules read the chain. No AI picks the rating." },
    { n: "3", title: "Stamp", body: "The exact answer is stamped on Solana before it is posted." },
  ];
}

export default async function HomePage() {
  let checks: CheckRecord[] = [];
  let stats: ScorecardStats | null = null;
  let windowDays = 7;
  let handle: string = DEFAULTS.xBotHandle;
  let failed = false;

  try {
    const rt = await getRuntime();
    windowDays = rt.config.outcomeWindowDays;
    handle = rt.config.xBotHandle;
    checks = await rt.store.listChecks({ limit: 200, kinds: SCORECARD_KINDS });
    stats = computeStats(checks, {
      windowDays: rt.config.outcomeWindowDays,
      sharpDropPct: rt.config.sharpDropPct,
      callWinPct: rt.config.callWinPct,
    });
  } catch (err) {
    logError("home record failed", { detail: errorMessage(err) });
    failed = true;
  }

  if (failed || !stats) {
    return (
      <main className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="font-serif text-4xl tracking-tight">The record did not load.</h1>
        <p className="mt-3 text-lg leading-7 text-muted">Something went wrong on our side. Try again in a minute.</p>
      </main>
    );
  }

  return (
    <main className="py-10 sm:py-14">
      <section className="relative">
        <div className="ledger-grid pointer-events-none absolute inset-x-0 -top-6 h-56" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="rise font-serif text-4xl leading-[1.08] tracking-tight sm:text-6xl">
            Is this Solana token risky?
          </h1>
          <p className="rise mt-4 text-lg leading-8 text-muted" style={{ animationDelay: "80ms" }}>
            Paste it here or tag @{handle} on X. Every answer is stamped on Solana and kept on this record.
          </p>
          <div className="rise" style={{ animationDelay: "140ms" }}>
            <SearchBox />
          </div>
        </div>
      </section>

      <section className="rise mt-16" style={{ animationDelay: "180ms" }}>
        <h2 className="font-serif text-3xl tracking-tight">How it works</h2>
        <ol className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          {steps(handle).map((step) => (
            <li key={step.n} className="bg-panel px-5 py-5">
              <p className="font-mono text-sm text-accent-text">{step.n}</p>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-base leading-7 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rise mt-16" style={{ animationDelay: "220ms" }}>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-serif text-3xl tracking-tight">Track record</h2>
          <p className="text-base text-faint">Scored after {stats.windowDays} days</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Recorded checks"
            value={stats.totalChecks}
            detail="Calls, warnings, and replies."
          />
          <Stat
            label="Call win rate"
            value={percentPoints(stats.callWinRate)}
            suffix="%"
            decimals={1}
            detail={
              stats.callSample
                ? `Up ${stats.callWinPct}% or more, of ${stats.callSample} scored`
                : `None scored yet. A win is up ${stats.callWinPct}% or more.`
            }
          />
          <Stat
            label="Label accuracy"
            value={percentPoints(stats.labelAccuracy)}
            suffix="%"
            decimals={1}
            detail={
              stats.labelSample
                ? `Of ${stats.labelSample} scored LOW and HIGH`
                : "None scored yet."
            }
          />
          <Stat
            label="Steadiness of calls"
            value={stats.sharpe}
            decimals={2}
            detail={
              stats.sharpe == null
                ? "Needs two scored calls."
                : "Average return divided by how much it varies."
            }
          />
        </div>
      </section>

      <section className="rise mt-16" style={{ animationDelay: "260ms" }}>
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-serif text-3xl tracking-tight">Recent checks</h2>
          <Link href="/check" className="text-base text-accent-text hover:text-ink">
            Check a token
          </Link>
        </div>
        {checks.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line px-5 py-10">
            <h3 className="font-serif text-2xl">No checks yet</h3>
            <p className="mt-2 max-w-lg text-base leading-7 text-muted">Run the first one.</p>
            <Button asChild className="mt-5">
              <Link href="/check">Check a token</Link>
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
                  <span className="mt-1 block font-mono text-sm text-faint">
                    {check.tokenMint ? shortMint(check.tokenMint) : "—"}
                  </span>
                  <span className="mt-1 block text-sm text-faint">
                    {formatTime(check.createdAt)} · {kindLabel(check.kind)}
                    {check.dataMode === "mock" ? " · demo data" : ""}
                  </span>
                  <span className="mt-1 block text-base text-muted">{outcomeLabel(check, windowDays)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {checks.length > 0 ? (
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-line md:block">
            <table className="w-full min-w-[40rem] text-left text-base">
              <caption className="sr-only">Recent Lens checks</caption>
              <thead className="border-b border-line text-sm text-faint">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    When
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Token
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Address
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Rating
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
                      <span className="mt-0.5 block text-sm text-faint">
                        {kindLabel(check.kind)}
                        {check.dataMode === "mock" ? " · demo data" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-muted">
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
      <p className="text-base text-faint">{label}</p>
      <p className="mt-2 font-serif text-4xl tracking-tight tabular-nums">
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </p>
      <p className="mt-2 text-base leading-6 text-faint">{detail}</p>
    </div>
  );
}

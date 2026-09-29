import Link from "next/link";
import { computeStats, type CheckRecord, type ScorecardStats } from "@lens/core";
import { ModeBanner } from "@/components/mode-banner";
import { RiskStamp } from "@/components/risk-stamp";
import { SearchBox } from "@/components/search-box";
import { formatRate, formatTime, kindLabel, outcomeLabel } from "@/lib/format";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "01",
    title: "Tag or paste",
    body: "Reply @askLens under any Solana coin on X, or paste a mint address or $TICKER in the box above.",
  },
  {
    n: "02",
    title: "Fixed rules, named sources",
    body: "Lens reads liquidity, holders, and authorities, then writes the facts. The level comes from rules, not a vibe.",
  },
  {
    n: "03",
    title: "Prove, then show",
    body: "The exact reply is hashed into a Solana memo before it is stored. Anyone can recompute the hash and check the chain.",
  },
];

export default async function HomePage() {
  let checks: CheckRecord[] = [];
  let stats: ScorecardStats | null = null;
  let dataMode = "mock";
  let proofMode = "mock";
  let windowDays = 7;
  let error: string | null = null;

  try {
    const rt = await getRuntime();
    dataMode = rt.config.dataMode;
    proofMode = rt.config.proofMode;
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
        <h1 className="text-3xl font-semibold tracking-tight">The record is not ready.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
          Create the database with <code className="text-white">npm run demo</code> or{" "}
          <code className="text-white">npm run db:push</code>, then reload.
        </p>
        <p className="mt-4 text-sm text-rose-300">{error}</p>
      </main>
    );
  }

  return (
    <main className="py-10 sm:py-14">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300">Lens · @askLens</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
        Tag @askLens on X under any Solana coin and get an instant, provable risk check
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">
        LOW means no major red flags. It does not mean the price will rise. Every check stays on the public record,
        including the ones that were wrong.
      </p>
      <SearchBox />
      <ModeBanner dataMode={dataMode} proofMode={proofMode} />

      <section className="mt-16">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">How it works</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="font-mono text-xs text-emerald-300">{step.n}</p>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Public track record</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Recorded checks" value={String(stats.totalChecks)} detail="Calls, warnings, and replies" />
          <Stat
            label="Call win rate"
            value={formatRate(stats.callWinRate)}
            detail={
              stats.callSample
                ? `${stats.callSample} call${stats.callSample === 1 ? "" : "s"} up at least ${stats.callWinPct}%`
                : `Needs a scored call up at least ${stats.callWinPct}%`
            }
          />
          <Stat
            label="High-risk that dropped"
            value={formatRate(stats.highRiskDropRate)}
            detail={
              stats.highRiskSample
                ? `${stats.highRiskSample} HIGH check${stats.highRiskSample === 1 ? "" : "s"}, drop of ${Math.abs(stats.sharpDropPct)}%+`
                : "No scored HIGH checks yet"
            }
          />
          <Stat
            label="Low-risk that held"
            value={formatRate(stats.lowRiskHeldRate)}
            detail={
              stats.lowRiskSample
                ? `${stats.lowRiskSample} LOW check${stats.lowRiskSample === 1 ? "" : "s"} that did not drop ${Math.abs(stats.sharpDropPct)}%+`
                : "No scored LOW checks yet"
            }
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Label accuracy across scored LOW and HIGH checks: {formatRate(stats.labelAccuracy)}
          {stats.labelSample ? ` (${stats.labelSample})` : ""}. Sharpe of call returns:{" "}
          {stats.sharpe == null ? "—" : stats.sharpe.toFixed(2)}
          {stats.sharpe == null ? " (needs two scored calls)" : ""}. Default window is {stats.windowDays} days. Flats
          count as not wins.
        </p>
      </section>

      <section className="mt-16">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Recent checks</h2>
          <Link href="/check" className="text-sm text-emerald-300 hover:text-emerald-200">
            Run a check
          </Link>
        </div>
        {checks.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 px-5 py-10">
            <p className="text-lg font-medium">Nothing posted yet.</p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-400">
              From the repo, run <code className="text-white">npm run demo</code>. That simulates an @askLens mention,
              proves the reply, scores it, and leaves it here.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
            {checks.map((check) => (
              <li key={check.id}>
                <Link
                  href={`/r/${check.id}`}
                  className="grid gap-2 px-4 py-4 hover:bg-white/[0.03] sm:grid-cols-[9rem_1fr_auto_11rem] sm:items-center"
                >
                  <span className="text-xs text-zinc-500">{formatTime(check.createdAt)}</span>
                  <span className="min-w-0">
                    <span className="font-medium">${check.tokenSymbol}</span>
                    <span className="ml-2 text-xs uppercase tracking-wide text-zinc-500">
                      {kindLabel(check.kind)}
                      {check.dataMode === "mock" ? " · mock" : ""}
                    </span>
                    <span className="mt-1 block truncate text-xs text-zinc-500">{check.tokenName}</span>
                  </span>
                  <RiskStamp level={check.riskLevel} />
                  <span
                    className={`text-sm ${(check.outcome?.priceChangePct ?? 0) < 0 ? "text-rose-300" : "text-zinc-200"}`}
                  >
                    {outcomeLabel(check, windowDays)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {stats.scoredChecks > 0 ? (
          <p className="mt-3 text-xs text-zinc-500">Price change is measured from the check to the scoring job.</p>
        ) : null}
      </section>
    </main>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

import Link from "next/link";
import { computeStats, type CheckRecord, type ScorecardStats } from "@lens/core";
import { ModeBanner } from "@/components/mode-banner";
import { RiskStamp } from "@/components/risk-stamp";
import { formatRate, formatTime, kindLabel, outcomeLabel } from "@/lib/format";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

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
      <main className="py-10">
        <h1 className="font-serif text-3xl">The record is not ready.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
          Create the database with <code className="text-ink">npm run demo</code> or{" "}
          <code className="text-ink">npm run db:push</code>, then reload.
        </p>
        <p className="mt-4 text-sm text-high">{error}</p>
      </main>
    );
  }

  return (
    <main className="py-8">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">Public scorecard</p>
      <h1 className="mt-2 max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">
        Every check stays up, including the ones that were wrong.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
        Tag @askLens under a Solana post, or paste a token here. Lens writes the facts, hashes the
        exact reply, and only then sends it. LOW means no major red flags. It does not mean the
        price will rise.
      </p>
      <ModeBanner dataMode={dataMode} proofMode={proofMode} />

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </section>
      <p className="mt-3 text-xs leading-5 text-muted">
        Label accuracy across scored LOW and HIGH checks: {formatRate(stats.labelAccuracy)}
        {stats.labelSample ? ` (${stats.labelSample})` : ""}. Sharpe of call returns:{" "}
        {stats.sharpe == null ? "—" : stats.sharpe.toFixed(2)}
        {stats.sharpe == null ? " (needs two scored calls)" : ""}. Default window is {stats.windowDays}{" "}
        days. Flats count as not wins.
      </p>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-serif text-2xl">The record</h2>
          <Link href="/check" className="text-sm underline">
            Run a check
          </Link>
        </div>
        {checks.length === 0 ? (
          <div className="mt-4 border border-dashed border-line bg-paper-2 px-4 py-8">
            <p className="font-serif text-xl">Nothing posted yet.</p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
              From the repo, run <code className="text-ink">npm run demo</code>. That simulates an
              @askLens mention, proves the reply, scores it, and leaves it here.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-ink">
            {checks.map((check) => (
              <li key={check.id}>
                <Link
                  href={`/r/${check.id}`}
                  className="grid gap-2 py-4 hover:bg-paper-2 sm:grid-cols-[8.5rem_1fr_7rem_9rem] sm:items-center"
                >
                  <span className="text-xs text-muted">{formatTime(check.createdAt)}</span>
                  <span>
                    <span className="font-medium">${check.tokenSymbol}</span>
                    <span className="ml-2 text-xs uppercase tracking-wide text-muted">
                      {kindLabel(check.kind)}
                      {check.dataMode === "mock" ? " · mock" : ""}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted">{check.tokenName}</span>
                  </span>
                  <RiskStamp level={check.riskLevel} />
                  <span
                    className={`text-sm ${
                      (check.outcome?.priceChangePct ?? 0) < 0 ? "text-high" : "text-ink"
                    }`}
                  >
                    {outcomeLabel(check, windowDays)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {stats.scoredChecks > 0 ? (
          <p className="mt-3 text-xs text-muted">
            Price change is measured from the check to the scoring job.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border border-line bg-paper-2 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-3xl leading-none">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{detail}</p>
    </div>
  );
}

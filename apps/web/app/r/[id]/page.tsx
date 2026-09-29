import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ExternalLink, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { levelSummary, verifyPostedText, xStatusUrl, type Fact } from "@lens/core";
import { RiskStamp } from "@/components/risk-stamp";
import { TokenLogo } from "@/components/token-logo";
import { Button } from "@/components/ui/button";
import { formatChange, formatTime, formatUsd, kindLabel } from "@/lib/format";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const LIQUIDITY_FULL_USD = 50_000;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rt = await getRuntime();
  const check = await rt.store.getCheck(id);
  if (!check) return { title: "Report" };
  return {
    title: `$${check.tokenSymbol} ${check.riskLevel}`,
    description:
      check.riskLevel === "NONE"
        ? `${check.tokenName || check.tokenSymbol}: no token was found.`
        : `$${check.tokenSymbol}: ${check.riskLevel} risk. ${levelSummary(check.riskLevel)}`,
  };
}

function factIcon(signal: Fact["signal"]) {
  if (signal === "danger") return ShieldAlert;
  if (signal === "caution") return AlertTriangle;
  if (signal === "good") return ShieldCheck;
  return ShieldQuestion;
}

function factTone(signal: Fact["signal"]) {
  if (signal === "danger") return "text-rose-300 bg-rose-500/10 ring-rose-400/30";
  if (signal === "caution") return "text-amber-200 bg-amber-400/10 ring-amber-300/30";
  if (signal === "good") return "text-emerald-300 bg-emerald-400/10 ring-emerald-300/30";
  return "text-zinc-300 bg-white/5 ring-white/10";
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rt = await getRuntime();
  const check = await rt.store.getCheck(id);
  if (!check) notFound();

  const verification =
    check.proof?.txSignature != null
      ? await verifyPostedText(rt.proofs, check.replyText, check.proof.txSignature)
      : null;
  const postUrl = xStatusUrl(check.xPostId);
  const summary = check.riskLevel === "NONE" ? "No token was found in that post." : levelSummary(check.riskLevel);
  const price = check.snapshot?.priceUsd ?? check.priceAtCheck;
  const holders = check.snapshot?.top10HolderPct ?? null;
  const liquidity = check.snapshot?.liquidityUsd ?? null;
  const high = check.riskLevel === "HIGH";
  const verifyHref = check.proof?.txSignature
    ? `/verify?signature=${encodeURIComponent(check.proof.txSignature)}&text=${encodeURIComponent(check.replyText)}`
    : null;

  return (
    <main className="py-8 sm:py-12">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
        {kindLabel(check.kind)} · {formatTime(check.createdAt)}
        {check.askedBy ? ` · @${check.askedBy}` : ""}
      </p>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <TokenLogo mint={check.tokenMint} symbol={check.tokenSymbol} size={64} />
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-tight sm:text-4xl">
              {check.tokenName || `$${check.tokenSymbol}`}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              ${check.tokenSymbol}
              <span className="mx-2 text-zinc-600">·</span>
              <span className="tabular-nums">{formatUsd(price)}</span>
            </p>
          </div>
        </div>
        <RiskStamp level={check.riskLevel} large />
      </div>

      <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300">{summary}</p>
      {check.tokenMint ? <p className="mt-2 break-all font-mono text-xs text-zinc-500">{check.tokenMint}</p> : null}
      {check.dataMode === "mock" ? (
        <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          These facts came from mock fixtures, not a mainnet read.
        </p>
      ) : (
        <p className="mt-4 text-xs text-zinc-500">Sources: {check.sources.join(", ") || "none recorded"}.</p>
      )}

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        {check.facts.length === 0 ? (
          <p className="text-sm text-zinc-500">No token facts were recorded.</p>
        ) : (
          check.facts.map((fact) => {
            const Icon = factIcon(fact.signal);
            return (
              <article key={fact.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <span className={`grid size-8 place-items-center rounded-full ring-1 ${factTone(fact.signal)}`}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{fact.signal}</p>
                </div>
                <p className="mt-3 text-sm leading-6">{fact.text}</p>
                {fact.sourceUrl ? (
                  <a
                    href={fact.sourceUrl}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {fact.sourceLabel ?? "Source"}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <Meter
          label="Top 10 holder concentration"
          valueLabel={holders == null ? "Not reported" : `${holders.toFixed(1)}%`}
          width={holders == null ? 0 : Math.max(0, Math.min(100, holders))}
          tone={holders == null ? "muted" : holders >= 70 ? "high" : holders >= 50 ? "med" : "low"}
          caption="Share of supply held by the ten largest wallets."
        />
        <Meter
          label="Liquidity"
          valueLabel={formatUsd(liquidity)}
          width={liquidity == null ? 0 : Math.max(4, Math.min(100, (liquidity / LIQUIDITY_FULL_USD) * 100))}
          tone={liquidity == null ? "muted" : liquidity < 10_000 ? "high" : liquidity < LIQUIDITY_FULL_USD ? "med" : "low"}
          caption="Bar fills at $50k pooled liquidity. Deeper pools stay full."
        />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">Exact text that was hashed</h2>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-zinc-200">{check.replyText}</pre>
        </div>

        <aside className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.04] p-5">
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-emerald-300">On-chain proof</h2>
          {check.proof ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">SHA-256</dt>
                <dd className="mt-1 break-all font-mono text-xs">{check.proof.contentHash}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">Signed at</dt>
                <dd className="mt-1">{formatTime(check.proof.signedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">Cluster</dt>
                <dd className="mt-1 capitalize">{check.proof.cluster}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">Signature</dt>
                <dd className="mt-1 break-all font-mono text-xs">{check.proof.txSignature}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">Check</dt>
                <dd className={`mt-1 ${verification?.ok ? "text-emerald-300" : "text-rose-300"}`}>
                  {verification?.ok ? "Text matches this proof." : (verification?.reason ?? "Not verified.")}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">No proof was stored.</p>
          )}
          <div className="mt-5 flex flex-col gap-2">
            {check.proof?.explorerUrl ? (
              <Button asChild variant="outline">
                <a href={check.proof.explorerUrl} target="_blank" rel="noreferrer">
                  Open in Solana explorer
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              </Button>
            ) : (
              <p className="text-xs leading-5 text-zinc-500">
                This proof is on the mock cluster. It is public in this database and can be checked with the verify
                form. It was not sent to Solana.
              </p>
            )}
            {verifyHref ? (
              <Button asChild>
                <Link href={verifyHref}>Verify</Link>
              </Button>
            ) : null}
            {postUrl ? (
              <a className="text-sm text-emerald-300 hover:text-emerald-200" href={postUrl} target="_blank" rel="noreferrer">
                View the X post
              </a>
            ) : null}
          </div>
          {check.outcome ? (
            <p className="mt-4 border-t border-white/10 pt-3 text-sm">
              After {check.outcome.windowDays} day{check.outcome.windowDays === 1 ? "" : "s"}:{" "}
              {formatChange(check.outcome.priceChangePct)} ({check.outcome.callResult})
            </p>
          ) : check.riskLevel !== "NONE" ? (
            <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-zinc-500">
              Price outcome is scored after {rt.config.outcomeWindowDays} days. Run <code>npm run score</code> once
              the window has passed.
            </p>
          ) : null}
        </aside>
      </section>

      {check.tokenMint ? (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">Trade</h2>
          {high ? (
            <div className="mt-4">
              <button
                type="button"
                disabled
                className="inline-flex h-11 items-center rounded-full bg-white/10 px-5 text-sm font-medium text-zinc-500"
              >
                Trade on Jupiter
              </button>
              <p className="mt-3 max-w-xl text-sm leading-6 text-rose-200" role="status">
                HIGH risk. The Jupiter buy button is off. Read the facts above before you move any funds. Not
                financial advice.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild>
                <a href={`https://jup.ag/swap/SOL-${check.tokenMint}`} target="_blank" rel="noreferrer">
                  Trade on Jupiter
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              </Button>
              <a className="text-sm text-zinc-400 hover:text-white" href={`/api/actions/trade/${check.tokenMint}`}>
                Solana Blink action
              </a>
            </div>
          )}
          {high && check.tokenMint ? (
            <a className="mt-3 inline-block text-sm text-zinc-500 hover:text-zinc-300" href={`/api/actions/trade/${check.tokenMint}`}>
              Solana Blink action
            </a>
          ) : null}
        </section>
      ) : null}

      {check.sourcePostText ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">Post that was read</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{check.sourcePostText}</p>
        </section>
      ) : null}
      <p className="mt-8 text-sm text-zinc-400">Not financial advice.</p>
    </main>
  );
}

function Meter({
  label,
  valueLabel,
  width,
  tone,
  caption,
}: {
  label: string;
  valueLabel: string;
  width: number;
  tone: "high" | "med" | "low" | "muted";
  caption: string;
}) {
  const bar =
    tone === "high" ? "bg-rose-400" : tone === "med" ? "bg-amber-300" : tone === "low" ? "bg-emerald-400" : "bg-zinc-600";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{label}</h2>
        <p className="tabular-nums text-sm text-zinc-300">{valueLabel}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${label} ${valueLabel}`}>
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 text-xs text-zinc-500">{caption}</p>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { levelSummary, verifyPostedText, xStatusUrl, type Fact, type Signal } from "@lens/core";
import { MintLine } from "@/components/mint-line";
import { TokenLogo } from "@/components/token-logo";
import { Button } from "@/components/ui/button";
import { FACT_MEANING, levelName, signalLabel } from "@/lib/facts";
import { formatChange, formatTime, formatUsd, kindLabel } from "@/lib/format";
import { noticeBody, tickerNoticeTitle } from "@/lib/notices";
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
        ? noticeBody(check.replyText)
        : `$${check.tokenSymbol}: ${levelName(check.riskLevel)}. ${levelSummary(check.riskLevel)}`,
  };
}

function signalClass(signal: Signal): string {
  if (signal === "danger") return "text-high";
  if (signal === "caution") return "text-med";
  if (signal === "good") return "text-low";
  return "text-muted";
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
  const unscored = check.riskLevel === "NONE";
  const summary = check.riskLevel === "NONE" ? noticeBody(check.replyText) : levelSummary(check.riskLevel);
  const price = check.snapshot?.priceUsd ?? check.priceAtCheck;
  const holders = check.snapshot?.top10HolderPct ?? null;
  const liquidity = check.snapshot?.liquidityUsd ?? null;
  const high = check.riskLevel === "HIGH";
  const onSolana = check.proof != null && check.proof.cluster !== "mock";
  const verifyHref = check.proof?.txSignature
    ? `/verify?signature=${encodeURIComponent(check.proof.txSignature)}&text=${encodeURIComponent(check.replyText)}`
    : null;
  const tone =
    check.riskLevel === "HIGH"
      ? "border-high bg-high-bg"
      : check.riskLevel === "MEDIUM"
        ? "border-med bg-med-bg"
        : check.riskLevel === "LOW"
          ? "border-low bg-low-bg"
          : "border-line bg-panel";

  return (
    <main className="py-8 sm:py-12">
      <p className="text-sm text-faint">
        <Link href="/" className="hover:text-ink">
          Record
        </Link>
        <span className="mx-2">/</span>
        {kindLabel(check.kind)} · {formatTime(check.createdAt)}
        {check.askedBy ? ` · @${check.askedBy}` : ""}
      </p>

      <section className={`verdict-reveal mt-5 rounded-2xl border-l-4 ${tone} px-5 py-5 sm:px-6`}>
        {unscored ? (
          <>
            <p className="text-sm font-medium text-ink">{tickerNoticeTitle(check.replyText)}</p>
            <p className="mt-3 max-w-2xl whitespace-pre-line text-lg leading-7 text-ink">{summary}</p>
            <p className="mt-3 text-sm text-faint">Lens did not assign a risk level.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-ink">{levelName(check.riskLevel)}</p>
            <p
              className={`mt-1 font-serif text-6xl tracking-tight sm:text-7xl ${
                check.riskLevel === "HIGH" ? "text-high" : check.riskLevel === "MEDIUM" ? "text-med" : "text-low"
              }`}
            >
              {check.riskLevel}
            </p>
            <p className="mt-3 max-w-2xl text-lg leading-7 text-ink">{summary}</p>
            {check.outcome ? (
              <p className="mt-3 text-sm text-muted">
                After {check.outcome.windowDays} day{check.outcome.windowDays === 1 ? "" : "s"}:{" "}
                {formatChange(check.outcome.priceChangePct)} ({check.outcome.callResult}).
              </p>
            ) : (
              <p className="mt-3 text-sm text-faint">
                The price outcome is scored after {rt.config.outcomeWindowDays} days.
              </p>
            )}
          </>
        )}
      </section>

      <div className="mt-6 flex items-center gap-4">
        <TokenLogo mint={check.tokenMint} symbol={check.tokenSymbol} size={56} />
        <div className="min-w-0">
          <h1 className="truncate font-serif text-3xl tracking-tight sm:text-4xl">
            {check.tokenName || `$${check.tokenSymbol}`}
          </h1>
          <p className="mt-1 text-sm text-muted">
            ${check.tokenSymbol}
            {price != null ? (
              <>
                <span className="mx-2 text-faint">·</span>
                <span className="tabular-nums">{formatUsd(price)}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {check.tokenMint ? (
        <div className="mt-5">
          <MintLine mint={check.tokenMint} />
        </div>
      ) : null}

      {unscored ? (
        check.dataMode === "mock" ? (
          <p className="mt-4 rounded-xl border border-med/40 bg-med-bg px-3 py-2 text-sm text-med">
            Mock mode. This notice is not a mainnet read.
          </p>
        ) : null
      ) : check.dataMode === "mock" ? (
        <p className="mt-4 rounded-xl border border-med/40 bg-med-bg px-3 py-2 text-sm text-med">
          These facts came from mock fixtures, not a mainnet read.
        </p>
      ) : (
        <p className="mt-4 text-sm text-faint">Sources: {check.sources.join(", ") || "none recorded"}.</p>
      )}

      {unscored ? null : (
      <section className="mt-8 grid gap-3 md:grid-cols-2">
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
          caption="The bar fills at $50k of pooled liquidity. Deeper pools stay full."
        />
      </section>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-3xl tracking-tight">What was checked</h2>
        {unscored ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            No token facts were recorded. The notice above is the whole result, and the hashed text below is what was stamped.
          </p>
        ) : (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Each line is a fact from the rules. The note under it says what that fact means.
        </p>
        )}
        {unscored || check.facts.length === 0 ? (
          unscored ? null : <p className="mt-4 text-sm text-faint">No token facts were recorded.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {check.facts.map((fact) => (
              <FactRow key={fact.id} fact={fact} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="text-sm font-medium text-faint">Exact text that was hashed</h2>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-ink">{check.replyText}</pre>
        </div>
        <aside className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-serif text-2xl tracking-tight">Proof</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {onSolana
              ? "This exact text was stamped on Solana at this time. Anyone can check it."
              : "This exact text was hashed and saved in the local record at this time. It was not sent to Solana. Anyone with this database can recompute the hash."}
          </p>
          {check.proof ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-faint">When</dt>
                <dd className="mt-0.5">{formatTime(check.proof.signedAt)}</dd>
              </div>
              <div>
                <dt className="text-faint">Where</dt>
                <dd className="mt-0.5 capitalize">{check.proof.cluster}</dd>
              </div>
              <div>
                <dt className="text-faint">SHA-256 of that text</dt>
                <dd className="mt-0.5 break-all font-mono text-xs">{check.proof.contentHash}</dd>
              </div>
              <div>
                <dt className="text-faint">Signature</dt>
                <dd className="mt-0.5 break-all font-mono text-xs">{check.proof.txSignature}</dd>
              </div>
              <div>
                <dt className="text-faint">Check</dt>
                <dd className={`mt-1 flex items-center gap-2 ${verification?.ok ? "text-low" : "text-high"}`}>
                  {verification?.ok ? <VerifiedMark /> : null}
                  <span>{verification?.ok ? "Verified. The text matches this stamp." : (verification?.reason ?? "Not verified.")}</span>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">No proof was stored.</p>
          )}
          <div className="mt-5 flex flex-col gap-2">
            {verifyHref ? (
              <Button asChild>
                <Link href={verifyHref}>Verify this text</Link>
              </Button>
            ) : null}
            {check.proof?.explorerUrl ? (
              <Button asChild variant="outline">
                <a href={check.proof.explorerUrl} target="_blank" rel="noreferrer">
                  Open in Solana explorer
                </a>
              </Button>
            ) : null}
            {postUrl ? (
              <a className="text-sm text-accent-text hover:text-ink" href={postUrl} target="_blank" rel="noreferrer">
                View the X post
              </a>
            ) : null}
          </div>
        </aside>
      </section>

      {check.tokenMint ? (
        <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
          <h2 className="text-sm font-medium text-faint">Trade</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Lens does not hold funds and does not send this trade. Jupiter asks you to sign it in your own wallet.
          </p>
          {high ? (
            <div className="mt-4">
              <button
                type="button"
                disabled
                className="inline-flex h-11 items-center rounded-full bg-panel-2 px-5 text-sm font-semibold text-faint"
              >
                Trade on Jupiter
              </button>
              <p className="mt-3 max-w-xl text-sm leading-6 text-high" role="status">
                High risk. The buy action is off. Read the facts above before you move any funds. Not financial advice.
              </p>
            </div>
          ) : (
            <div className="mt-4">
              <Button asChild>
                <a href={`https://jup.ag/swap/SOL-${check.tokenMint}`} target="_blank" rel="noreferrer">
                  Trade on Jupiter
                </a>
              </Button>
            </div>
          )}
          <a className="mt-3 inline-block text-sm text-faint hover:text-ink" href={`/api/actions/trade/${check.tokenMint}`}>
            Solana Blink action
          </a>
        </section>
      ) : null}

      {check.sourcePostText ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-faint">Post that was read</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{check.sourcePostText}</p>
        </section>
      ) : null}
      <p className="mt-8 text-sm text-muted">Not financial advice.</p>
    </main>
  );
}

function FactRow({ fact }: { fact: Fact }) {
  const meaning = FACT_MEANING[fact.id];
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-base leading-6">{fact.text}</p>
        <p className={`text-sm font-semibold ${signalClass(fact.signal)}`}>{signalLabel(fact.signal)}</p>
      </div>
      {meaning ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{meaning}</p> : null}
      {fact.sourceUrl ? (
        <a href={fact.sourceUrl} className="mt-1 inline-block text-sm text-accent-text hover:text-ink" target="_blank" rel="noreferrer">
          {fact.sourceLabel ?? "Source"}
        </a>
      ) : null}
    </li>
  );
}

function VerifiedMark() {
  return (
    <svg viewBox="0 0 24 24" className="proof-draw size-5 shrink-0" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
  const bar = tone === "high" ? "bg-high" : tone === "med" ? "bg-med" : tone === "low" ? "bg-low" : "bg-faint";
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{label}</h2>
        <p className="tabular-nums text-sm text-muted">{valueLabel}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel-2" role="img" aria-label={`${label} ${valueLabel}`}>
        <div className={`meter-fill h-full rounded-full ${bar}`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 text-sm text-faint">{caption}</p>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { levelSummary, verifyPostedText, xStatusUrl } from "@lens/core";
import { RiskStamp } from "@/components/risk-stamp";
import { formatChange, formatTime, kindLabel } from "@/lib/format";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Report ${id}` };
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

  return (
    <main className="py-8">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">
        {kindLabel(check.kind)} · {formatTime(check.createdAt)}
        {check.askedBy ? ` · @${check.askedBy}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="font-serif text-5xl">${check.tokenSymbol}</h1>
        <RiskStamp level={check.riskLevel} large />
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6">{summary}</p>
      <p className="mt-1 text-sm text-muted">{check.tokenName}</p>
      {check.tokenMint ? (
        <p className="mt-2 break-all font-mono text-xs text-muted">{check.tokenMint}</p>
      ) : null}
      {check.dataMode === "mock" ? (
        <p className="mt-4 border border-med/40 bg-[#f3e6cf] px-3 py-2 text-sm text-med">
          These facts came from mock fixtures, not a mainnet read.
        </p>
      ) : (
        <p className="mt-4 text-xs text-muted">Sources: {check.sources.join(", ") || "none recorded"}.</p>
      )}

      <section className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div>
          <h2 className="font-serif text-2xl">Facts</h2>
          {check.facts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No token facts were recorded.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {check.facts.map((fact) => (
                <li key={fact.id} className="py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted">{fact.signal}</p>
                  <p className="mt-1 text-sm leading-6">{fact.text}</p>
                  {fact.sourceUrl ? (
                    <a href={fact.sourceUrl} className="mt-1 inline-block text-xs underline" target="_blank" rel="noreferrer">
                      {fact.sourceLabel ?? "Source"}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-8 font-serif text-2xl">Exact text that was hashed</h2>
          <pre className="mt-3 whitespace-pre-wrap border border-ink bg-paper-2 p-4 font-sans text-sm leading-6">
            {check.replyText}
          </pre>
        </div>

        <aside className="h-fit border border-ink bg-paper-2 p-4">
          <h2 className="font-serif text-2xl">Proof</h2>
          {check.proof ? (
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-muted">SHA-256</dt>
                <dd className="mt-1 break-all font-mono text-xs">{check.proof.contentHash}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-muted">Signed at</dt>
                <dd className="mt-1">{formatTime(check.proof.signedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-muted">Cluster</dt>
                <dd className="mt-1">{check.proof.cluster}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-muted">Signature</dt>
                <dd className="mt-1 break-all font-mono text-xs">{check.proof.txSignature}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-muted">Check</dt>
                <dd className={`mt-1 ${verification?.ok ? "text-low" : "text-high"}`}>
                  {verification?.ok ? "Text matches this proof." : verification?.reason ?? "Not verified."}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">No proof was stored.</p>
          )}
          <div className="mt-4 flex flex-col gap-2 text-sm">
            {check.proof?.explorerUrl ? (
              <a className="underline" href={check.proof.explorerUrl} target="_blank" rel="noreferrer">
                Open in Solana explorer
              </a>
            ) : (
              <p className="text-xs leading-5 text-muted">
                This proof is on the mock cluster. It is public in this database and can be checked
                with the verify form. It was not sent to Solana.
              </p>
            )}
            {check.proof?.txSignature ? (
              <Link className="underline" href={`/verify?signature=${encodeURIComponent(check.proof.txSignature)}`}>
                Verify this text
              </Link>
            ) : null}
            {postUrl ? (
              <a className="underline" href={postUrl} target="_blank" rel="noreferrer">
                View the X post
              </a>
            ) : null}
            {check.tokenMint ? (
              <a className="underline" href={`/api/actions/trade/${check.tokenMint}`}>
                Blink trade action
              </a>
            ) : null}
          </div>
          {check.outcome ? (
            <p className="mt-4 border-t border-line pt-3 text-sm">
              After {check.outcome.windowDays} day{check.outcome.windowDays === 1 ? "" : "s"}:{" "}
              {formatChange(check.outcome.priceChangePct)} ({check.outcome.callResult})
            </p>
          ) : check.riskLevel !== "NONE" ? (
            <p className="mt-4 border-t border-line pt-3 text-xs leading-5 text-muted">
              Price outcome is scored after {rt.config.outcomeWindowDays} days. Run{" "}
              <code>npm run score</code> once the window has passed.
            </p>
          ) : null}
        </aside>
      </section>
      {check.sourcePostText ? (
        <section className="mt-8">
          <h2 className="font-serif text-2xl">Post that was read</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{check.sourcePostText}</p>
        </section>
      ) : null}
      <p className="mt-8 text-sm">Not financial advice.</p>
    </main>
  );
}

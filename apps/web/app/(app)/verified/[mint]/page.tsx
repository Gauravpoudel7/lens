import Link from "next/link";
import { headers } from "next/headers";
import { DISCLAIMER, isSolanaAddress, tradeView, verifiedView, type TeamInfo } from "@lens/core";
import { CopyButton } from "@/components/copy-button";
import { ModeNotice } from "@/components/mode-notice";
import { TokenLogo } from "@/components/token-logo";
import { formatTime, formatUsdc } from "@/lib/format";
import { allowRequest, clientKeyFromHeaders } from "@/lib/rate-limit";
import { getRuntime } from "@/lib/runtime";
import { loadTradeCheck } from "@/lib/trade-check";
import { ProPanel } from "../../pro/pro-panel";
import { CheckedBadge } from "../checked-badge";
import { TeamForm } from "./team-form";

export const dynamic = "force-dynamic";

const TONE = {
  LOW: { text: "text-low", box: "border-low/40 bg-low-bg" },
  MEDIUM: { text: "text-med", box: "border-med/40 bg-med-bg" },
  HIGH: { text: "text-high", box: "border-high/40 bg-high-bg" },
  NONE: { text: "text-muted", box: "border-line bg-panel" },
} as const;

const DOT = { danger: "bg-high", caution: "bg-med", good: "bg-low", unknown: "bg-faint" } as const;

const TEAM_LABELS: Array<[keyof TeamInfo, string]> = [
  ["website", "Website"],
  ["xUrl", "X"],
  ["telegramUrl", "Telegram"],
  ["auditUrl", "Audit"],
  ["lockProofUrl", "Liquidity lock proof"],
];

export async function generateMetadata({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  if (!isSolanaAddress(mint)) return { title: "Not a token address" };
  const rt = await getRuntime();
  const recent = await rt.store.latestCheckForMint(mint, 365 * 24 * 60 * 60 * 1000);
  return { title: recent ? `$${recent.tokenSymbol} Verified` : "Verified" };
}

function verifyHref(signature: string | null | undefined, text: string): string {
  return signature ? `/verify?signature=${encodeURIComponent(signature)}&text=${encodeURIComponent(text)}` : "/verify";
}

export default async function VerifiedPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  if (!isSolanaAddress(mint)) {
    return <p className="py-16 text-center text-lg text-muted">Not a valid Solana token address.</p>;
  }
  const rt = await getRuntime();
  const key = clientKeyFromHeaders(await headers(), "trade");
  const [loaded, listing] = await Promise.all([
    loadTradeCheck(rt, mint, () => allowRequest(key, rt.config.checkApiLimitPerHour)),
    rt.store.getVerifiedListing(mint),
  ]);
  const check = loaded.check;
  const view = verifiedView(listing, check);
  const trade = check ? tradeView(check) : null;
  const tone = TONE[view.level];

  return (
    <main className="rise mx-auto w-full max-w-[560px] space-y-5 py-6 sm:py-8">
      <ModeNotice />
      <header className="flex items-center gap-3">
        <TokenLogo mint={mint} symbol={trade?.symbol ?? "TOKEN"} size={44} fallback={false} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">${trade?.symbol ?? "TOKEN"}</h1>
          <div className="-ml-2 flex items-center">
            <span className="pl-2 font-mono text-sm text-faint">{trade?.shortMint ?? mint}</span>
            <CopyButton value={mint} label="Copy token address" icon />
          </div>
        </div>
        {view.badge ? (
          <div className="ml-auto">
            <CheckedBadge mock={view.mock} />
          </div>
        ) : null}
      </header>

      <section aria-label="Risk level" className={`rounded-3xl border px-6 py-5 ${tone.box}`}>
        <p className="text-sm font-medium text-muted">Live rating by Lens rules</p>
        <p className={`text-5xl font-semibold tracking-tight ${tone.text}`}>{view.level === "NONE" ? "—" : view.level}</p>
        <p className="mt-2 text-base text-muted">
          {check ? (
            <time dateTime={check.createdAt}>Checked {formatTime(check.createdAt)}</time>
          ) : (
            "Lens could not rate this token right now. Try again in a minute."
          )}
        </p>
      </section>

      {trade?.facts.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {trade.facts.map((fact) => (
            <li key={fact.text} className="flex items-center gap-3 py-2.5 text-[15px] text-ink">
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[fact.signal]}`} />
              <span className="truncate">{fact.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {view.active && listing ? (
        <>
          <section aria-labelledby="team" className="rounded-2xl border border-line bg-panel p-5">
            <h2 id="team" className="text-base font-semibold text-ink">
              Provided by the team
            </h2>
            <p className="mt-1 text-base text-muted">Lens did not check these links. They do not affect the rating.</p>
            {TEAM_LABELS.some(([field]) => listing[field]) ? (
              <dl className="mt-3 space-y-2">
                {TEAM_LABELS.filter(([field]) => listing[field]).map(([field, label]) => (
                  <div key={field} className="flex flex-wrap gap-x-3">
                    <dt className="text-base text-muted">{label}</dt>
                    <dd className="min-w-0 break-all">
                      <a
                        href={listing[field]!}
                        target="_blank"
                        rel="nofollow ugc noopener noreferrer"
                        className="text-base text-accent-text underline-offset-4 hover:text-ink hover:underline"
                      >
                        {listing[field]}
                      </a>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-base text-faint">The team has not added links yet.</p>
            )}
            <p className="mt-3 text-sm text-faint">Verified page active until {formatTime(listing.paidUntil)}.</p>
          </section>
          <TeamForm
            mint={mint}
            initial={{
              website: listing.website,
              xUrl: listing.xUrl,
              telegramUrl: listing.telegramUrl,
              auditUrl: listing.auditUrl,
              lockProofUrl: listing.lockProofUrl,
            }}
          />
        </>
      ) : (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl tracking-tight">No Verified page</h2>
          <p className="text-base text-muted">
            The team can add their links here for {formatUsdc(rt.config.verifiedPriceUsdc)} USDC per{" "}
            {rt.config.verifiedPeriodDays} days, paid from the wallet that created the token. The rating stays the same.
          </p>
          <ProPanel
            priceUsd={rt.config.verifiedPriceUsdc}
            periodDays={rt.config.verifiedPeriodDays}
            treasurySet={Boolean(rt.config.proTreasury) && rt.config.verifiedPriceUsdc > 0}
            ttlHours={rt.config.proCheckoutTtlHours}
            listingMint={mint}
          />
        </section>
      )}

      <p className="text-base text-muted">
        Lens Verified means the team paid for this page. It never changes the rating and is not an endorsement.
      </p>

      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-base text-faint">
        {trade ? (
          <>
            <Link href={trade.reportPath} className="underline-offset-4 hover:text-ink hover:underline">
              Full report
            </Link>
            <span aria-hidden>·</span>
            <Link
              href={verifyHref(check?.proof?.txSignature, check?.replyText ?? "")}
              className="underline-offset-4 hover:text-ink hover:underline"
            >
              Verify proof
            </Link>
            <span aria-hidden>·</span>
          </>
        ) : null}
        <Link href="/verified" className="underline-offset-4 hover:text-ink hover:underline">
          All Verified coins
        </Link>
        <span aria-hidden>·</span>
        <span>{DISCLAIMER}</span>
      </p>
    </main>
  );
}

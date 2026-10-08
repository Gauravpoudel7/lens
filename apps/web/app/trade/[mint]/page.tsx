import Link from "next/link";
import { headers } from "next/headers";
import { ArrowUpRight } from "lucide-react";
import { DISCLAIMER, isSolanaAddress, tradeView, type TradeView } from "@lens/core";
import { CopyButton } from "@/components/copy-button";
import { TokenLogo } from "@/components/token-logo";
import { Button } from "@/components/ui/button";
import { levelName } from "@/lib/facts";
import { allowRequest, clientKeyFromHeaders } from "@/lib/rate-limit";
import { getRuntime } from "@/lib/runtime";
import { loadTradeCheck, type TradeCheckResult } from "@/lib/trade-check";

export const dynamic = "force-dynamic";

const TONE = {
  LOW: { text: "text-low", box: "border-low/40 bg-low-bg" },
  MEDIUM: { text: "text-med", box: "border-med/40 bg-med-bg" },
  HIGH: { text: "text-high", box: "border-high/40 bg-high-bg" },
  NONE: { text: "text-muted", box: "border-line bg-panel" },
} as const;

const DOT = { danger: "bg-high", caution: "bg-med", good: "bg-low", unknown: "bg-faint" } as const;

const ERRORS: Record<Exclude<TradeCheckResult, { check: object }>["error"], string> = {
  rate_limited: "Too many checks. Try again later.",
  token_not_found: "Token not found.",
  proof_failed: "Could not prove this check. Try again soon.",
  unavailable: "Lens could not score this token.",
};

async function load(mint: string): Promise<TradeCheckResult> {
  const rt = await getRuntime();
  const key = clientKeyFromHeaders(await headers(), "trade");
  return loadTradeCheck(rt, mint, () => allowRequest(key, rt.config.checkApiLimitPerHour));
}

export async function generateMetadata({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  if (!isSolanaAddress(mint)) return { title: "Not a token address" };
  const rt = await getRuntime();
  // Read-only: metadata never runs a check. Any stored check from the last year names the token.
  const recent = await rt.store.latestCheckForMint(mint, 365 * 24 * 60 * 60 * 1000);
  if (!recent || recent.riskLevel === "NONE") return { title: "Trade" };
  return {
    title: `$${recent.tokenSymbol} ${recent.riskLevel}`,
    description: `$${recent.tokenSymbol}: ${levelName(recent.riskLevel)}. Checked by Lens. Not financial advice.`,
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="rise mx-auto w-full max-w-[480px] py-6 sm:py-8">{children}</main>;
}

function Message({ title, mint }: { title: string; mint?: string }) {
  return (
    <Shell>
      <div className="rounded-3xl border border-line bg-panel px-6 py-10 text-center">
        <p className="text-lg font-semibold text-ink">{title}</p>
        {mint ? <p className="mt-2 break-all font-mono text-xs text-faint">{mint}</p> : null}
        <Link href="/check" className="mt-6 inline-block text-sm text-faint underline-offset-4 hover:text-ink hover:underline">
          Check a token
        </Link>
      </div>
    </Shell>
  );
}

function verifyHref(signature: string | null | undefined, text: string): string {
  return signature
    ? `/verify?signature=${encodeURIComponent(signature)}&text=${encodeURIComponent(text)}`
    : "/verify";
}

function Action({ view }: { view: TradeView }) {
  if (!view.buyUrl) {
    return (
      <div className="rounded-2xl border border-high/40 bg-high-bg px-5 py-4" role="status">
        <p className="font-semibold text-high">{view.level === "HIGH" ? "High risk. No buy link." : "Not scored. No buy link."}</p>
        <p className="mt-1 text-sm text-muted">Read the full report first.</p>
      </div>
    );
  }
  const medium = view.level === "MEDIUM";
  return (
    <div>
      {medium ? <p className="mb-2.5 text-sm text-med">Buy with care</p> : null}
      <Button asChild variant={medium ? "outline" : "default"} className="h-14 w-full text-base">
        <a href={view.buyUrl} target="_blank" rel="noopener noreferrer">
          Buy on Jupiter
          <ArrowUpRight className="size-4" aria-hidden />
          <span className="sr-only">(opens Jupiter in a new tab)</span>
        </a>
      </Button>
    </div>
  );
}

export default async function TradePage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  if (!isSolanaAddress(mint)) return <Message title="Not a valid Solana token address." />;

  const loaded = await load(mint);
  if (!loaded.check) return <Message title={ERRORS[loaded.error]} mint={mint} />;

  const check = loaded.check;
  const view = tradeView(check);
  const tone = TONE[view.level];

  return (
    <Shell>
      <header className="flex items-center gap-3">
        <TokenLogo mint={view.mint} symbol={view.symbol} size={44} fallback={false} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">${view.symbol}</h1>
          <div className="-ml-2 flex items-center">
            <span className="pl-2 font-mono text-sm text-faint">{view.shortMint}</span>
            <CopyButton value={view.mint} label="Copy mint" icon />
          </div>
        </div>
      </header>

      <section aria-label="Risk level" className={`mt-5 rounded-3xl border px-6 py-5 ${tone.box}`}>
        <p className={`text-5xl font-semibold tracking-tight ${tone.text}`}>{view.level === "NONE" ? "—" : view.level}</p>
        <p className="mt-2 text-sm text-muted">
          <time dateTime={view.checkedAt}>{checkedAgo(view.checkedAt)}</time>
        </p>
      </section>

      {view.facts.length ? (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {view.facts.map((fact) => (
            <li key={fact.text} className="flex items-center gap-3 py-2.5 text-[15px] text-ink">
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[fact.signal]}`} />
              <span className="truncate">{fact.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5">
        <Action view={view} />
      </div>

      <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-faint">
        <Link href={view.reportPath} className="underline-offset-4 hover:text-ink hover:underline">
          Full report
        </Link>
        <span aria-hidden>·</span>
        <Link href={verifyHref(check.proof?.txSignature, check.replyText)} className="underline-offset-4 hover:text-ink hover:underline">
          Verify proof
        </Link>
        <span aria-hidden>·</span>
        <span>{DISCLAIMER}</span>
      </p>
    </Shell>
  );
}

function checkedAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "Checked just now";
  if (minutes < 60) return `Checked ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Checked ${hours} h ago`;
  return `Checked ${Math.round(hours / 24)} d ago`;
}

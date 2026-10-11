import { isActiveListing, type TeamInfo, type UserRecord, type VerifiedListingRecord } from "./accounts.js";
import { openCheckout, type BillingDeps } from "./billing/service.js";
import type { CheckoutSession } from "./billing/solana-pay.js";
import { isSolanaAddress } from "./discover.js";
import type { TokenDataProvider } from "./providers/types.js";
import { publicActionBaseUrl } from "./swap.js";
import { TRADE_CHECK_MAX_AGE_MS } from "./trade.js";
import type { CheckRecord, RiskLevel } from "./types.js";

/**
 * Lens Verified is a paid page for a coin team. It shows team links and the live rating.
 * Nothing here reads into the risk engine: the level always comes from a stored check.
 */

export const TEAM_FIELDS = ["website", "xUrl", "telegramUrl", "auditUrl", "lockProofUrl"] as const;

const MAX_URL = 200;

/** Only the token's creator wallet may buy the page, so nobody else can post links under the coin's name. */
export async function startVerifiedCheckout(
  deps: BillingDeps & { provider: Pick<TokenDataProvider, "getToken"> },
  input: { wallet?: string | null; mint?: string | null },
  now = new Date(),
): Promise<{ ok: true; session: CheckoutSession; user: UserRecord } | { ok: false; error: string }> {
  const wallet = input.wallet?.trim() ?? "";
  const mint = input.mint?.trim() ?? "";
  if (!isSolanaAddress(mint)) return { ok: false, error: "That is not a Solana token address." };
  if (!isSolanaAddress(wallet)) return { ok: false, error: "That wallet address is not valid." };
  const listing = await deps.store.getVerifiedListing(mint);
  if (listing && isActiveListing(listing, now) && listing.ownerWallet !== wallet) {
    return { ok: false, error: "This token already has an active Verified page." };
  }
  const snapshot = await deps.provider.getToken(mint);
  if (!snapshot) return { ok: false, error: "Token not found. Check the address." };
  if (!snapshot.creatorWallet) {
    return { ok: false, error: "Lens can't find this token's creator wallet yet, so it can't be verified." };
  }
  if (snapshot.creatorWallet !== wallet) {
    return { ok: false, error: "Pay from the wallet that created this token." };
  }
  return openCheckout(deps, wallet, {
    amountUsd: deps.config.verifiedPriceUsdc,
    priceEnv: "VERIFIED_PRICE_USDC",
    message: `Lens Verified for ${deps.config.verifiedPeriodDays} days`,
    purpose: "verified",
    listingMint: mint,
  });
}

export interface VerifiedView {
  active: boolean;
  level: RiskLevel | "NONE";
  /** The check is recent enough to stand for "now". */
  fresh: boolean;
  /** "Checked by Lens" shows only for an active listing whose fresh check is LOW. Payment cannot set it. */
  badge: boolean;
  mock: boolean;
}

export function verifiedView(
  listing: Pick<VerifiedListingRecord, "paidUntil"> | null,
  check: Pick<CheckRecord, "riskLevel" | "createdAt" | "dataMode"> | null,
  now = new Date(),
): VerifiedView {
  const active = isActiveListing(listing, now);
  const level = check?.riskLevel ?? "NONE";
  const age = check ? now.getTime() - Date.parse(check.createdAt) : Number.NaN;
  const fresh = Number.isFinite(age) && age <= TRADE_CHECK_MAX_AGE_MS;
  return { active, level, fresh, badge: active && fresh && level === "LOW", mock: check?.dataMode === "mock" };
}

/** https links only. A bad field rejects the whole edit, so nothing half-valid is stored. */
export function cleanTeamInfo(
  input: Partial<Record<(typeof TEAM_FIELDS)[number], unknown>> | null,
): { ok: true; info: TeamInfo } | { ok: false; error: string } {
  const info = {} as TeamInfo;
  for (const field of TEAM_FIELDS) {
    const raw = input?.[field];
    if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) {
      info[field] = null;
      continue;
    }
    if (typeof raw !== "string" || raw.trim().length > MAX_URL) {
      return { ok: false, error: `Use a link of at most ${MAX_URL} characters.` };
    }
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      return { ok: false, error: "Each link must be a full https:// address." };
    }
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) {
      return { ok: false, error: "Each link must be a full https:// address." };
    }
    info[field] = url.toString();
  }
  return { ok: true, info };
}

/** "verify $TICKER" or "verify <mint>" in the mention itself. */
const VERIFY_COMMAND = /\bverify\s+(?:\$[A-Za-z]|[1-9A-HJ-NP-Za-km-z]{32,44}\b)/i;

export function wantsVerifiedPage(text: string): boolean {
  return VERIFY_COMMAND.test(text.replace(/@\w+/g, " "));
}

/** Public https page URL, or null when the site is local and a link would be useless. */
export function verifiedPageUrl(publicBaseUrl: string, mint: string): string | null {
  const base = publicActionBaseUrl(publicBaseUrl);
  return base ? `${base}/verified/${mint}` : null;
}

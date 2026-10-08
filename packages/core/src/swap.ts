import type { RiskLevel } from "./types.js";
import { tradePageUrl } from "./trade.js";

const TRADE_VERB = /\b(buy|swap|trade)(?!-)\b/gi;

/**
 * A question or a refusal in the same clause as the verb.
 * "should I buy?" does not get a link. "buy $BONK" does.
 */
const HEDGE =
  /\b(?:should\s+i|should\s+not|shouldn'?t|can\s+i|cannot|can't|could\s+i|do\s+i|do\s+not|don'?t|dont|would\s+i|is\s+it\s+safe\s+to|safe\s+to)\b/i;

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export type SwapLinkDecision =
  | { include: true; url: string }
  | { include: false; reason: string };

/** True when this mention text itself asks to buy, swap, or trade. */
export function wantsTradeLink(text: string): boolean {
  const cleaned = text.replace(/https?:\/\/\S+/gi, " ").replace(/@\w+/g, " ");
  for (const match of cleaned.matchAll(TRADE_VERB)) {
    const index = match.index ?? 0;
    const prior = cleaned.slice(0, index);
    const cut = Math.max(
      prior.lastIndexOf("."),
      prior.lastIndexOf("!"),
      prior.lastIndexOf("?"),
      prior.lastIndexOf(","),
      prior.lastIndexOf(";"),
      prior.lastIndexOf("\n"),
    );
    const clause = prior.slice(cut + 1);
    if (!HEDGE.test(clause)) return true;
  }
  return false;
}

/** https origin (and optional path) that wallets can unfurl. Local and raw IPs do not count. */
export function publicActionBaseUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith(".local")) return null;
  if (isIpAddress(host)) return null;
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path === "/" ? "" : path}`;
}

/** The reply links to the human `/trade` page; Blink-aware clients map it to the Action via `actions.json`. */
export function swapActionUrl(base: string, mint: string): string {
  return tradePageUrl(base, mint);
}

/** True for the `/trade/<mint>` link and for the older `/api/actions/trade/<mint>` link in cached replies. */
export function replyHasSwapLink(text: string, mint: string): boolean {
  return text.includes(`/trade/${mint}`);
}

/**
 * One Blink URL, or a reason to leave the reply link-free.
 * `null` means the mention did not ask, so nothing is logged.
 */
export function decideSwapLink(input: {
  asked: boolean;
  enabled: boolean;
  publicBaseUrl: string;
  riskLevel: RiskLevel | "NONE";
  mint: string;
}): SwapLinkDecision | null {
  if (!input.asked) return null;
  if (!input.enabled) {
    return { include: false, reason: "X_SWAP_LINKS_ON_REQUEST is false" };
  }
  if (input.riskLevel === "HIGH") {
    return { include: false, reason: "HIGH risk has no buy link" };
  }
  if ((input.riskLevel !== "LOW" && input.riskLevel !== "MEDIUM") || !input.mint) {
    return { include: false, reason: "token was not scored" };
  }
  const base = publicActionBaseUrl(input.publicBaseUrl);
  if (!base) {
    return { include: false, reason: "PUBLIC_BASE_URL is not a public https URL" };
  }
  return { include: true, url: swapActionUrl(base, input.mint) };
}

function isIpAddress(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

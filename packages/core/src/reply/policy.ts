import type { Fact, RiskLevel } from "../types.js";

export interface ReplyDraftInput {
  riskLevel: RiskLevel;
  symbol: string;
  name: string;
  /** Mint that was scored. Scored replies name it with a short form. */
  mint?: string | null;
  facts: Fact[];
  reportUrl: string;
  /** When true, the reply may include the report URL. Default is link-free. */
  includeLinks?: boolean;
  /**
   * Plain-text place to find the report when links are off.
   * Empty omits the closer. A hostname here is text, not a URL.
   */
  siteLabel?: string | null;
  /**
   * Blink trade URL for a mention that asked to buy, swap, or trade.
   * When set, this is the only URL in the reply.
   */
  swapUrl?: string | null;
}

export const DISCLAIMER = "Not financial advice.";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

const TLDS =
  "com|org|net|io|co|app|xyz|gg|me|dev|ai|so|link|fun|finance|exchange|tech|site|info|biz|ag";

const EXPLICIT_URL = /(?:https?:\/\/|t\.co\/)[^\s<>()]+/gi;
const BARE_DOMAIN = new RegExp(
  String.raw`\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:${TLDS})\b(?:/[^\s<>()]*)?`,
  "gi",
);

const SIGNAL_RANK: Record<Fact["signal"], number> = {
  danger: 3,
  caution: 2,
  unknown: 1,
  good: 0,
};

export function linksRequested(input: Pick<ReplyDraftInput, "includeLinks">): boolean {
  return input.includeLinks === true;
}

/** `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` → `JUPy…DvCN`. */
export function shortMint(mint: string): string {
  const trimmed = mint.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function replyHeader(symbol: string, riskLevel: string, mint?: string | null): string {
  const mark = mint ? ` (${shortMint(mint)})` : "";
  return `$${symbol}${mark}: ${riskLevel} risk.`;
}

/**
 * Unknown facts stay on the report page. The X reply drops them, because
 * "could not be verified" reads like a warning when the data is simply missing.
 * The incomplete line stays: it is why a sparse snapshot is not LOW.
 */
export function factsForReply(facts: Fact[]): Fact[] {
  return facts.filter((fact) => fact.signal !== "unknown" || fact.id === "incomplete");
}

/** Name wins. Otherwise a non-local PUBLIC_BASE_URL host. Localhost omits the line. */
export function publicSiteLabel(config: { publicSiteName?: string; publicBaseUrl: string }): string | null {
  const named = config.publicSiteName?.trim();
  if (named) return named.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  try {
    const host = new URL(config.publicBaseUrl).hostname.toLowerCase();
    if (!host || LOCAL_HOSTS.has(host) || host.endsWith(".local")) return null;
    return host;
  } catch {
    return null;
  }
}

export function closerLine(
  input: Pick<ReplyDraftInput, "includeLinks" | "reportUrl" | "siteLabel" | "swapUrl">,
): string | null {
  if (!input.swapUrl && linksRequested(input)) return `Report: ${input.reportUrl}`;
  const label = input.siteLabel?.trim();
  if (!label) return null;
  return `Full report on ${label}.`;
}

/** Remove http(s), t.co, and bare domains. Leaves prices, percents, and tickers alone. */
export function stripReplyUrls(text: string): string {
  const stripped = text.replace(EXPLICIT_URL, "").replace(BARE_DOMAIN, "");
  return stripped
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .filter((line) => line.length > 0 && !/^Report:\s*$/i.test(line))
    .join("\n")
    .trim();
}

export function buildTemplateReply(input: ReplyDraftInput, maxLength = 280): string {
  const header = replyHeader(input.symbol, input.riskLevel, input.mint);
  const closer = closerLine(input);
  const swapUrl = input.swapUrl?.trim() || null;
  const ranked = factsForReply(input.facts).sort((a, b) => {
    const bySignal = SIGNAL_RANK[b.signal] - SIGNAL_RANK[a.signal];
    if (bySignal !== 0) return bySignal;
    if (a.id === "claims") return -1;
    if (b.id === "claims") return 1;
    return 0;
  });
  const shorts = ranked.map((fact) => fact.short.trim()).filter(Boolean);
  const chosen: string[] = [];
  for (const short of shorts) {
    const candidate = render(header, [...chosen, short], closer, swapUrl);
    if (candidate.length <= maxLength) chosen.push(short);
    else break;
  }
  let text: string;
  if (chosen.length === 0 && shorts[0]) {
    let fact = shorts[0];
    text = render(header, [fact], closer, swapUrl);
    while (text.length > 500 && fact.length > 24) {
      fact = `${fact.slice(0, fact.length - 8).trim()}…`;
      text = render(header, [fact], closer, swapUrl);
    }
  } else {
    text = render(header, chosen, closer, swapUrl);
  }
  if (swapUrl && text.length > 500) {
    return buildTemplateReply({ ...input, swapUrl: undefined }, maxLength);
  }
  return text;
}

function render(header: string, facts: string[], closer: string | null, swapUrl: string | null): string {
  const lines = [header, ...facts.map((fact) => `• ${fact}`)];
  if (closer) lines.push(closer);
  if (swapUrl) lines.push(`Swap: ${swapUrl}`);
  lines.push(DISCLAIMER);
  return lines.join("\n");
}

function riskLevels(text: string): string[] {
  return text.match(/\b(LOW|MEDIUM|HIGH)\b/g) ?? [];
}

function levelIsFaithful(text: string, riskLevel: RiskLevel): boolean {
  const levels = riskLevels(text);
  return levels.some((level) => level === riskLevel) && levels.every((level) => level === riskLevel);
}

export function enforceReplyPolicy(
  raw: string,
  input: ReplyDraftInput,
): { ok: true; text: string } | { ok: false; text: string; reason: string } {
  let text = raw.replace(/\r/g, "").trim();
  text = text.replace(/\bscam(?:s|med|mer|ming)?\b/gi, "high risk");
  if (/\bscam\b/i.test(text)) return { ok: false, text, reason: "scam" };

  if (!levelIsFaithful(text, input.riskLevel)) {
    return { ok: false, text, reason: "risk level" };
  }

  const swapOnly = Boolean(input.swapUrl?.trim());
  if (!swapOnly && linksRequested(input)) {
    if (!text.includes(input.reportUrl)) {
      text = text.replace(/\s*Not financial advice\.?\s*$/i, "").trim();
      text = `${text}\nReport: ${input.reportUrl}`;
    }
  } else {
    text = stripReplyUrls(text);
    if (!levelIsFaithful(text, input.riskLevel)) {
      return { ok: false, text, reason: "risk level" };
    }
  }

  text = text.replace(/\s*Not financial advice\.?\s*$/i, "").trim();
  text = ensureShortMint(text, input.mint);
  if (swapOnly || !linksRequested(input)) {
    text = stripReportLines(text);
    const closer = closerLine(input);
    if (closer) text = text ? `${text}\n${closer}` : closer;
  }
  text = `${text}\n${DISCLAIMER}`;
  text = placeSwapLine(text, input.swapUrl);

  if (text.length > 500) return { ok: false, text, reason: "too long" };
  if (/\bscam\b/i.test(text)) return { ok: false, text, reason: "scam" };
  return { ok: true, text };
}

/** Puts the Blink URL above the disclaimer. Drops it when the reply would pass 500 characters. */
function placeSwapLine(text: string, swapUrl?: string | null): string {
  const url = swapUrl?.trim();
  if (!url) return text;
  const line = `Swap: ${url}`;
  const stripped = text
    .split("\n")
    .filter((row) => {
      const trimmed = row.trim();
      if (/^Swap:\s*/i.test(trimmed)) return false;
      return !trimmed.includes(url);
    })
    .join("\n")
    .trim();
  let next: string;
  if (stripped.endsWith(DISCLAIMER)) {
    const body = stripped.slice(0, -DISCLAIMER.length).trim();
    next = body ? `${body}\n${line}\n${DISCLAIMER}` : `${line}\n${DISCLAIMER}`;
  } else {
    next = stripped ? `${stripped}\n${line}` : line;
  }
  if (next.length > 500) return stripped;
  const copies = next.split(url).length - 1;
  if (copies !== 1) return stripped;
  return next;
}

function stripReportLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^Full report on\b/i.test(line.trim()))
    .join("\n")
    .trim();
}

function ensureShortMint(text: string, mint?: string | null): string {
  if (!mint) return text;
  const short = shortMint(mint);
  if (text.includes(short)) return text;
  const replaced = text.replace(/^(\$[A-Za-z][A-Za-z0-9]{0,12})\b/, `$1 (${short})`);
  if (replaced.includes(short)) return replaced;
  return `${short}\n${text}`;
}

function notice(lines: string[]): string {
  return [...lines, "", DISCLAIMER].join("\n");
}

export function ambiguousTickerReply(symbol: string): string {
  return notice([
    `Several coins use $${symbol}. Reply with the contract address so I check the right one.`,
  ]);
}

export function multipleTokensReply(): string {
  return notice([
    "That post names more than one token. Reply with the contract address of the one you want checked.",
  ]);
}

export function unavailableTickerReply(symbol: string): string {
  return notice([
    `I couldn't confirm a verified $${symbol}. Reply with the contract address so I check the right one.`,
  ]);
}

export function foreignTickerReply(symbol: string): string {
  return notice([
    `$${symbol} isn't a Solana-native token, so I can't check it. If you meant a specific Solana token, reply with its contract address.`,
  ]);
}

export function nativeSolReply(): string {
  return notice([
    "$SOL is the native Solana asset, not a token I score. If you meant a specific token, reply with its contract address.",
  ]);
}

export function stableTickerReply(symbol: string, mint: string): string {
  return notice([
    `$${symbol} (${shortMint(mint)}) is the verified Solana stablecoin. I don't score it with these rules. If you meant a different token, reply with its contract address.`,
  ]);
}

export function wrappedMajorReply(symbol: string): string {
  return notice([
    `$${symbol} is a wrapped major from another chain. I don't score it with these rules. Reply with the Solana contract address if you meant a specific token.`,
  ]);
}

export const UNRESOLVED_REPLY = [
  "I couldn't find a Solana token in that post. Include a contract address or $ticker.",
  "",
  DISCLAIMER,
].join("\n");

export function assertSafeNotice(text: string): string {
  if (/\bscam\b/i.test(text)) {
    throw new Error("Notice failed the wording policy.");
  }
  if (!text.trim().endsWith(DISCLAIMER)) {
    throw new Error("Notice must end with the disclaimer.");
  }
  return text;
}

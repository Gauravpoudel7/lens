import type { Fact, RiskLevel } from "../types.js";

export interface ReplyDraftInput {
  riskLevel: RiskLevel;
  symbol: string;
  name: string;
  facts: Fact[];
  reportUrl: string;
  /** When true, the reply may include the report URL. Default is link-free. */
  includeLinks?: boolean;
}

export const DISCLAIMER = "Not financial advice.";
export const SCORECARD_LINE = "Full report on our scorecard.";

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

export function closerLine(input: Pick<ReplyDraftInput, "includeLinks" | "reportUrl">): string {
  return linksRequested(input) ? `Report: ${input.reportUrl}` : SCORECARD_LINE;
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
  const header = `$${input.symbol}: ${input.riskLevel} risk.`;
  const closer = closerLine(input);
  const ranked = [...input.facts].sort((a, b) => {
    const bySignal = SIGNAL_RANK[b.signal] - SIGNAL_RANK[a.signal];
    if (bySignal !== 0) return bySignal;
    if (a.id === "claims") return -1;
    if (b.id === "claims") return 1;
    return 0;
  });
  const shorts = ranked.map((fact) => fact.short.trim()).filter(Boolean);
  const chosen: string[] = [];
  for (const short of shorts) {
    const candidate = render(header, [...chosen, short], closer);
    if (candidate.length <= maxLength) chosen.push(short);
    else break;
  }
  if (chosen.length === 0 && shorts[0]) {
    let fact = shorts[0];
    let text = render(header, [fact], closer);
    while (text.length > 500 && fact.length > 24) {
      fact = `${fact.slice(0, fact.length - 8).trim()}…`;
      text = render(header, [fact], closer);
    }
    return text;
  }
  return render(header, chosen, closer);
}

function render(header: string, facts: string[], closer: string): string {
  return [header, ...facts.map((fact) => `• ${fact}`), closer, DISCLAIMER].join("\n");
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

  if (linksRequested(input)) {
    if (!text.includes(input.reportUrl)) {
      text = text.replace(/\s*Not financial advice\.?\s*$/i, "").trim();
      text = `${text}\nReport: ${input.reportUrl}`;
    }
  } else {
    text = stripReplyUrls(text);
    if (!levelIsFaithful(text, input.riskLevel)) {
      return { ok: false, text, reason: "risk level" };
    }
    text = text.replace(/\s*Not financial advice\.?\s*$/i, "").trim();
    if (!text.includes(SCORECARD_LINE)) {
      text = text ? `${text}\n${SCORECARD_LINE}` : SCORECARD_LINE;
    }
  }

  text = text.replace(/\s*Not financial advice\.?\s*$/i, "").trim();
  text = `${text}\n${DISCLAIMER}`;

  if (text.length > 500) return { ok: false, text, reason: "too long" };
  if (/\bscam\b/i.test(text)) return { ok: false, text, reason: "scam" };
  return { ok: true, text };
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

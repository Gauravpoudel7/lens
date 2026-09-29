import type { Fact, RiskLevel } from "../types.js";

export interface ReplyDraftInput {
  riskLevel: RiskLevel;
  symbol: string;
  name: string;
  facts: Fact[];
  reportUrl: string;
}

export const DISCLAIMER = "Not financial advice.";

const SIGNAL_RANK: Record<Fact["signal"], number> = {
  danger: 3,
  caution: 2,
  unknown: 1,
  good: 0,
};

export function buildTemplateReply(input: ReplyDraftInput, maxLength = 280): string {
  const header = `$${input.symbol}: ${input.riskLevel} risk.`;
  const link = `Report: ${input.reportUrl}`;
  const ranked = [...input.facts].sort((a, b) => SIGNAL_RANK[b.signal] - SIGNAL_RANK[a.signal]);
  const shorts = ranked.map((fact) => fact.short.trim()).filter(Boolean);
  const chosen: string[] = [];
  for (const short of shorts) {
    const candidate = render(header, [...chosen, short], link);
    if (candidate.length <= maxLength) chosen.push(short);
    else break;
  }
  if (chosen.length === 0 && shorts[0]) {
    let fact = shorts[0];
    let text = render(header, [fact], link);
    while (text.length > 500 && fact.length > 24) {
      fact = `${fact.slice(0, fact.length - 8).trim()}…`;
      text = render(header, [fact], link);
    }
    return text;
  }
  return render(header, chosen, link);
}

function render(header: string, facts: string[], link: string): string {
  return [header, ...facts.map((fact) => `• ${fact}`), link, DISCLAIMER].join("\n");
}

export function enforceReplyPolicy(
  raw: string,
  input: ReplyDraftInput,
): { ok: true; text: string } | { ok: false; text: string; reason: string } {
  let text = raw.replace(/\r/g, "").trim();
  text = text.replace(/\bscam(?:s|med|mer|ming)?\b/gi, "high risk");
  if (/\bscam\b/i.test(text)) return { ok: false, text, reason: "scam" };

  const levels = text.match(/\b(LOW|MEDIUM|HIGH)\b/g) ?? [];
  if (!levels.includes(input.riskLevel) || levels.some((level) => level !== input.riskLevel)) {
    return { ok: false, text, reason: "risk level" };
  }

  if (!text.includes(input.reportUrl)) {
    text = text.replace(/\s*Not financial advice\.?\s*$/i, "").trim();
    text = `${text}\nReport: ${input.reportUrl}`;
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

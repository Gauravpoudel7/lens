import type { ReplyDraftInput } from "./policy.js";

const RESERVED = new Set(["LOW", "MEDIUM", "HIGH", "NONE"]);

/** Alphanumeric ticker, or the short mint when the third-party symbol is not safe to post. */
export function safeSymbol(symbol: string, mint?: string | null): string {
  const cleaned = symbol.trim();
  if (/^[A-Za-z0-9]{1,10}$/.test(cleaned) && !RESERVED.has(cleaned.toUpperCase())) return cleaned;
  const trimmed = mint?.trim() ?? "";
  if (trimmed.length >= 8) return `${trimmed.slice(0, 4)}${trimmed.slice(-4)}`;
  return "TOKEN";
}

/** Drop @mentions, hashtags, and URLs from text we did not write. */
export function scrubThirdPartyText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bt\.co\/\S+/gi, "")
    .replace(/[@#][\w.]+/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function prepareReplyDraft(input: ReplyDraftInput): ReplyDraftInput {
  return {
    ...input,
    symbol: safeSymbol(input.symbol, input.mint),
    name: scrubThirdPartyText(input.name).slice(0, 40) || "token",
    facts: input.facts.map((fact) => ({
      ...fact,
      text: scrubThirdPartyText(fact.text),
      short: scrubThirdPartyText(fact.short),
    })),
  };
}

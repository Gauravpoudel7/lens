import type { Claims } from "./types.js";

const BURNED = /\bburn(?:ed|s|t)?\b/i;
const LOCKED = /\b(?:lp[\s-]*)?lock(?:ed|s|ing)?\b/i;

function statements(text: string): string {
  return text
    .split(/[\n]+/)
    .flatMap((line) => line.split(/(?<=[.!])\s+/))
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.includes("?"))
    .join(". ");
}

function claimed(text: string, pattern: RegExp): boolean {
  const body = statements(text);
  if (!pattern.test(body)) return false;
  const negated = new RegExp(
    `\\b(?:not|never|no|isn't|isnt|aren't|arent|wasn't|wasnt)\\b[^.]{0,40}${pattern.source}`,
    "i",
  );
  if (negated.test(body)) return false;
  return true;
}

export function extractClaims(text: string): Claims {
  return {
    burned: claimed(text, BURNED),
    locked: claimed(text, LOCKED),
  };
}

export function claimsFromPosts(parentText: string | null | undefined, mentionText: string): Claims {
  if (parentText && parentText.trim()) return extractClaims(parentText);
  return extractClaims(mentionText);
}

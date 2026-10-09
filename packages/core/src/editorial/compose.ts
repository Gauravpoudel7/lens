import { containsUrl, fitsX } from "../reply/length.js";
import { TERMS, TIPS } from "./content.js";

/** Every editorial post passes this before it is proved. Throws with the reason. */
export function assertEditorialText(text: string): string {
  if (!text.trim()) throw new Error("Editorial text is empty.");
  if (!fitsX(text)) throw new Error("Editorial text is over 280 weighted characters.");
  if (containsUrl(text)) throw new Error("Editorial text contains a URL.");
  if (/\bscam/i.test(text)) throw new Error("Editorial text failed the wording policy.");
  if (/#\w/.test(text)) throw new Error("Editorial text contains a hashtag.");
  return text;
}

export function composeTip(index: number): string {
  return assertEditorialText(`🛡️ Safety tip\n\n${TIPS[wrap(index, TIPS.length)]}`);
}

export function composeTerm(index: number): string {
  return assertEditorialText(`📘 ${TERMS[wrap(index, TERMS.length)]}`);
}

function wrap(index: number, length: number): number {
  const i = Number.isFinite(index) ? Math.floor(index) : 0;
  return ((i % length) + length) % length;
}

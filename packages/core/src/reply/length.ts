/**
 * X's v3 character weighting (twitter-text config v3).
 * Code points in the ranges below count 1, everything else counts 2,
 * an emoji (including ZWJ sequences and flags) counts 2 in total, and a URL counts 23.
 * `text.length` is wrong for X: "✅" and "•" are one UTF-16 unit but weigh 2.
 */
const LIGHT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];
const URL_WEIGHT = 23;
/** http(s) links, www. hosts, and bare `name.tld` hosts that X turns into links (x.com/…, pump.fun). */
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,24}\b(?:\/\S*)?/gi;
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

export function xWeightedLength(text: string): number {
  const normalized = text.normalize("NFC");
  let total = 0;
  let rest = "";
  let last = 0;
  for (const match of normalized.matchAll(URL_RE)) {
    rest += normalized.slice(last, match.index);
    total += URL_WEIGHT;
    last = match.index + match[0].length;
  }
  rest += normalized.slice(last);
  for (const { segment } of segmenter.segment(rest)) {
    if (EMOJI_RE.test(segment)) {
      total += 2;
      continue;
    }
    for (const char of segment) total += isLight(char.codePointAt(0)!) ? 1 : 2;
  }
  return total;
}

export function fitsX(text: string, limit = 280): boolean {
  return xWeightedLength(text) <= limit;
}

/** True when X would turn part of the text into a link. Editorial posts must not contain one. */
export function containsUrl(text: string): boolean {
  return new RegExp(URL_RE.source, "i").test(text);
}

function isLight(code: number): boolean {
  return LIGHT_RANGES.some(([start, end]) => code >= start && code <= end);
}

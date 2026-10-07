const DISCLAIMER = "Not financial advice.";

/** The notice lines that were hashed, without the closing disclaimer. */
export function noticeBody(replyText: string): string {
  const lines = replyText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== DISCLAIMER);
  return lines.join("\n") || "This ticker was not scored.";
}

/** A short heading for a ticker Lens will not score. The body stays the server text. */
export function tickerNoticeTitle(text: string): string {
  if (text.includes("Several coins use $") || text.includes("couldn't confirm a verified")) {
    return "Paste the contract address";
  }
  if (text.includes("isn't a Solana-native")) return "Not a Solana token";
  if (text.includes("native Solana asset")) return "SOL is not scored";
  if (text.includes("stablecoin")) return "Stablecoin, not scored";
  if (text.includes("wrapped major")) return "Wrapped token, not scored";
  return "Not scored";
}

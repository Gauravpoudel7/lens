import type { Risk } from "@/components/ui/badge";

// Illustrative examples built from Lens's own fixture tokens ($SAFE, $MID, $DANGER).
// They show the reply format; they are not live posts and not real tokens.
export type FeedItem = {
  kind: "reply" | "warning" | "call";
  post?: { name: string; handle: string; text: string; ago: string };
  risk: Risk;
  reply: string;
  ago: string;
  memo: string;
  signature: string;
};

export const FEED: FeedItem[] = [
  {
    kind: "reply",
    post: {
      name: "Timeline poster",
      handle: "placeholder_poster1",
      text: "$SAFE has been around forever, steady volume. Thoughts?",
      ago: "6m",
    },
    risk: "LOW",
    reply:
      "$SAFE: LOW risk.\n• No major red flags found.\n• Mint and freeze authority off.\n• Top 10 hold 38%.\n• Token is over 3 years old.\nLOW is not a price prediction.\nNot financial advice.",
    ago: "5m",
    memo: "lens:v1|2026-10-07T18:31:04Z|3b7e…a90c",
    signature: "Ex1a…mpLe1",
  },
  {
    kind: "reply",
    post: {
      name: "Timeline poster",
      handle: "placeholder_poster2",
      text: "New one just launched, $MID. Liquidity is in, dev is active.",
      ago: "14m",
    },
    risk: "MEDIUM",
    reply:
      "$MID: MEDIUM risk.\n• Mint authority is still on, so more supply can be created.\n• Liquidity about $24k.\nFull report on Lens.\nNot financial advice.",
    ago: "13m",
    memo: "lens:v1|2026-10-07T18:23:52Z|c41d…07be",
    signature: "Ex2b…mpLe2",
  },
  {
    kind: "reply",
    post: {
      name: "Timeline poster",
      handle: "placeholder_poster3",
      text: "$DANGER liquidity locked, devs doxxed, don’t miss this one 🚀",
      ago: "22m",
    },
    risk: "HIGH",
    reply:
      "$DANGER: HIGH risk.\n• Creator wallet sold 60% of supply.\n• Top 10 hold 86%.\n• Post says “liquidity locked”, but no lock found on-chain.\nNot financial advice.",
    ago: "21m",
    memo: "lens:v1|2026-10-07T18:15:40Z|9f2c…e81a",
    signature: "Ex3c…mpLe3",
  },
  {
    kind: "warning",
    risk: "HIGH",
    reply:
      "Warning: $DANGER: HIGH risk.\n• Token is 1 hour old.\n• Top 10 hold 86%.\n• Liquidity under $50k.\nFull report on Lens.\nNot financial advice.",
    ago: "1h",
    memo: "lens:v1|2026-10-07T17:40:12Z|e6a0…51d3",
    signature: "Ex4d…mpLe4",
  },
  {
    kind: "call",
    risk: "LOW",
    reply:
      "Call: $SAFE: LOW risk.\n• Liquidity is large and locked.\n• Mint and freeze authority off.\n• Holders spread out, top 10 hold 38%.\nLOW is not a price prediction.\nNot financial advice.",
    ago: "3h",
    memo: "lens:v1|2026-10-07T15:02:27Z|71bf…c2e9",
    signature: "Ex5e…mpLe5",
  },
];

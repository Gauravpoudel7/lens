import { X_HANDLE } from "@/lib/site";

export const HANDLE = `@${X_HANDLE}`;

export const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#proof", label: "Proof" },
  { href: "#pricing", label: "Pricing" },
];

// Spline scene from the component spec. TODO: swap for a Lens-branded scene.
export const SPLINE_SCENE = "https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode";

export const HERO = {
  eyebrow: "Live on X · Built on Solana",
  title: "The AI crypto analyst on X that can’t lie about its record.",
  // The hero renders the title on exactly these four lines.
  titleLines: ["The AI crypto", "analyst on X", "that can’t lie", "about its record."],
  sub: `Tag ${HANDLE} under any Solana post. Get the risk in plain English, proved on Solana.`,
  memo: "lens:v1|2026-10-07T18:42:11Z|9f2c…e81a", // used by the features proof tile
};

export const ECOSYSTEM = {
  label: "Reads the chain, not the hype",
  names: ["Solana", "Helius", "DexScreener", "RugCheck", "Birdeye", "Jupiter", "Solana Actions & Blinks", "Colosseum"],
};

export const PROBLEM = {
  title: "On X, the loudest post wins. The chain tells a different story.",
  cards: ["Traps look real", "Bad calls disappear", "AI tip bots are black boxes", "The facts are on-chain, but people read X"],
  libra: {
    when: "February 2025",
    body: "A coin promoted by a head of state fell ~90% in hours (per news reports). The signs were on-chain.",
  },
};

export const FEATURES = {
  title: "One analyst. Nothing hidden.",
  tiles: {
    replies: {
      title: `${HANDLE} replies`,
      body: "Risk level and facts, in the thread.",
    },
    proof: {
      title: "Proof before post",
      body: "Hashed to Solana before it posts.",
    },
    scorecard: {
      title: "Public scorecard",
      body: "Every call, wrong ones included.",
    },
    rules: {
      title: "Rules decide, AI only writes",
      body: "Rules set the level. AI only writes.",
    },
    blink: {
      title: "Blink, with risk first",
      body: "Risk first. No buy button on HIGH.",
    },
    pro: {
      title: "Pro alerts",
      body: "Watchlist and DM alerts. Paid in USDC.",
    },
  },
};

export const STEPS = ["Someone posts a coin", `You tag ${HANDLE}`, "Lens checks the chain", "Proof, then reply"];

export const CHECKS = [
  { check: "Coin age", danger: "Under 24 hours (under 7 days is caution)", good: "Months or years old" },
  { check: "Liquidity", danger: "Under $10k, or can be pulled", good: "Large and locked" },
  { check: "Top holders", danger: "Top 10 wallets hold 70%+ (50%+ is caution)", good: "Spread across many holders" },
  { check: "Creator wallet", danger: "Creator sold 40%+ (10%+ is caution)", good: "Not selling" },
  { check: "Mint authority", danger: "Still on, creator can print more", good: "Turned off" },
  { check: "Freeze authority", danger: "Still on, creator can freeze your coins", good: "Turned off" },
  { check: "Linked launch wallets", danger: "Linked wallets hold 30%+ (15%+ is caution)", good: "Normal buying" },
  { check: "Claims in the post", danger: "“Burned” or “locked” not backed by the chain", good: "Matches the chain" },
];

export const SCORING = [
  { level: "HIGH" as const, rule: "Two or more danger signs." },
  { level: "MEDIUM" as const, rule: "One danger sign, two cautions, or too much missing data." },
  { level: "LOW" as const, rule: "No major red flags found. Not a price prediction." },
];

export const FEED_COPY = {
  title: "What it looks like on your timeline.",
};

export const PROOF = {
  title: "Don’t trust the bot. Verify it.",
  sample:
    "$DANGER: HIGH risk.\n• Creator wallet sold 60% of supply.\n• Top 10 hold 86%.\nNot financial advice.",
  timestamp: "2026-10-07T18:42:11Z",
  points: [
    "Exact reply hashed (SHA-256) and written to Solana. No proof, no post.",
    "Anyone can re-hash and compare.",
  ],
};

export const REAL_STATS = [
  { label: "On-chain checks", value: 8, suffix: "" },
  { label: "Risk levels", value: 3, suffix: "" },
  { label: "Edits possible after posting", value: 0, suffix: "" },
  { label: "Free checks a day", value: 5, suffix: "" },
];

// configurable: PRO_PRICE_USDC in packages/core/src/config.ts (default 10)
export const PRO_PRICE_USDC = 10;

export const PRICING = {
  title: "Free to ask. Pro if you watch closely.",
  plans: [
    {
      name: "Free",
      price: "$0",
      cadence: "",
      blurb: "5 checks a day",
      items: ["Public replies", "Full public record"],
      cta: { label: `Tag ${HANDLE}`, kind: "x" as const },
    },
    {
      name: "Pro",
      price: `${PRO_PRICE_USDC} USDC`,
      cadence: "/ month",
      blurb: "For watchlists",
      items: ["Unlimited checks", "Private watchlist", "DM alerts when a token turns HIGH"],
      cta: { label: "Pay with USDC", kind: "pro" as const },
      note: "Pro never changes a risk level.",
    },
    {
      name: "Trades via Blink",
      price: "~0.5%",
      cadence: "fee",
      blurb: "On Blink trades",
      items: ["Risk shown first", "Your own wallet, via Jupiter", "No buy button on HIGH"],
      cta: { label: "See the record", kind: "record" as const },
    },
  ],
  footnote: "Lens never takes money to promote a coin.",
};

export const CTA = {
  title: "Check before you buy. Verify before you trust.",
};

export const DISCLAIMER =
  "Lens is an automated account. It shows facts with sources, never a buy or sell instruction, and every reply ends with “Not financial advice.” Wrong calls stay public.";

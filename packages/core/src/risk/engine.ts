import type { Claims, Fact, RiskLevel, RiskReport, Signal, TokenLinks, TokenSnapshot } from "../types.js";
import {
  AGE_CAUTION_HOURS,
  AGE_DANGER_HOURS,
  BURN_MATCH_PCT,
  CAUTION_WEIGHT,
  CREATOR_SOLD_CAUTION_PCT,
  CREATOR_SOLD_DANGER_PCT,
  DANGER_WEIGHT,
  HIGH_DANGER_COUNT,
  HIGH_SCORE,
  INCOMPLETE_UNKNOWN_COUNT,
  LIQUIDITY_LARGE_USD,
  LIQUIDITY_SMALL_USD,
  SNIPER_CAUTION_PCT,
  SNIPER_DANGER_PCT,
  TOP10_CAUTION_PCT,
  TOP10_DANGER_PCT,
} from "./thresholds.js";

export interface RuleInput {
  coinAgeHours: number | null;
  liquidityUsd: number | null;
  lpLocked: boolean | null;
  top10HolderPct: number | null;
  creatorSoldPct: number | null;
  creatorBalancePct: number | null;
  mintAuthorityActive: boolean | null;
  freezeAuthorityActive: boolean | null;
  sniperPct: number | null;
  burnedPct: number | null;
  claims: Claims;
}

interface DraftFact {
  id: string;
  signal: Signal;
  text: string;
  short: string;
}

function pct(value: number): string {
  return `${Math.round(value)}%`;
}

function usd(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `$${thousands >= 10 ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function ageLabel(hours: number): string {
  if (hours < 48) {
    const rounded = Math.max(1, Math.round(hours));
    return `${rounded} hour${rounded === 1 ? "" : "s"}`;
  }
  const days = Math.max(1, Math.round(hours / 24));
  return `${days} day${days === 1 ? "" : "s"}`;
}

function draft(id: string, signal: Signal, text: string, short: string): DraftFact {
  return { id, signal, text, short };
}

function coinAge(input: RuleInput): DraftFact {
  if (input.coinAgeHours == null) {
    return draft("coin_age", "unknown", "Token age could not be verified.", "Token age unknown.");
  }
  const hours = Math.max(0, input.coinAgeHours);
  const label = ageLabel(hours);
  if (hours < AGE_DANGER_HOURS) {
    return draft("coin_age", "danger", `This token is about ${label} old.`, `About ${label} old.`);
  }
  if (hours < AGE_CAUTION_HOURS) {
    return draft("coin_age", "caution", `This token is about ${label} old.`, `About ${label} old.`);
  }
  return draft("coin_age", "good", `This token is about ${label} old.`, `About ${label} old.`);
}

function liquidity(input: RuleInput): DraftFact {
  if (input.liquidityUsd == null) {
    return draft("liquidity", "unknown", "Liquidity could not be verified.", "Liquidity unknown.");
  }
  const size = usd(input.liquidityUsd);
  if (input.liquidityUsd < LIQUIDITY_SMALL_USD) {
    if (input.lpLocked === true) {
      return draft(
        "liquidity",
        "caution",
        `Liquidity is only ${size}, even though it is locked.`,
        `Liquidity is only ${size}.`,
      );
    }
    const unlocked =
      input.lpLocked === false ? " and it is not locked, so it can be pulled" : "";
    return draft(
      "liquidity",
      "danger",
      `Liquidity is only ${size}${unlocked}. That is small enough to move the price easily.`,
      `Liquidity is only ${size}.`,
    );
  }
  if (input.liquidityUsd < LIQUIDITY_LARGE_USD) {
    const lock =
      input.lpLocked === true
        ? " and it is locked"
        : input.lpLocked === false
          ? " and it is not locked"
          : ". Lock status could not be verified";
    return draft("liquidity", "caution", `Liquidity is ${size}${lock}.`, `Liquidity is ${size}.`);
  }
  if (input.lpLocked === true) {
    return draft(
      "liquidity",
      "good",
      `Liquidity is ${size} and it is locked.`,
      `Liquidity is ${size} and locked.`,
    );
  }
  if (input.lpLocked === false) {
    return draft(
      "liquidity",
      "caution",
      `Liquidity is ${size}, but it is not locked, so it can be pulled.`,
      `Liquidity is ${size} but not locked.`,
    );
  }
  return draft(
    "liquidity",
    "good",
    `Liquidity is ${size}. Whether it is locked could not be verified.`,
    `Liquidity is ${size}.`,
  );
}

function topHolders(input: RuleInput): DraftFact {
  if (input.top10HolderPct == null) {
    return draft(
      "top_holders",
      "unknown",
      "Top holder concentration could not be verified.",
      "Top holders unknown.",
    );
  }
  const share = pct(input.top10HolderPct);
  const text = `The top 10 wallets hold ${share} of supply.`;
  if (input.top10HolderPct >= TOP10_DANGER_PCT) {
    return draft("top_holders", "danger", text, `Top 10 hold ${share}.`);
  }
  if (input.top10HolderPct >= TOP10_CAUTION_PCT) {
    return draft("top_holders", "caution", text, `Top 10 hold ${share}.`);
  }
  return draft("top_holders", "good", text, `Top 10 hold ${share}.`);
}

function creator(input: RuleInput): DraftFact {
  if (input.creatorSoldPct != null) {
    const share = pct(input.creatorSoldPct);
    if (input.creatorSoldPct >= CREATOR_SOLD_DANGER_PCT) {
      return draft(
        "creator_wallet",
        "danger",
        `The creator wallet has sold ${share} of its tokens.`,
        `Creator sold ${share}.`,
      );
    }
    if (input.creatorSoldPct >= CREATOR_SOLD_CAUTION_PCT) {
      return draft(
        "creator_wallet",
        "caution",
        `The creator wallet has sold ${share} of its tokens.`,
        `Creator sold ${share}.`,
      );
    }
    return draft(
      "creator_wallet",
      "good",
      "The creator wallet has not been selling.",
      "Creator has not been selling.",
    );
  }
  if (input.creatorBalancePct != null) {
    return draft(
      "creator_wallet",
      "unknown",
      `The creator wallet currently holds ${pct(input.creatorBalancePct)} of supply. Recent sells could not be verified.`,
      "Creator sells could not be verified.",
    );
  }
  return draft(
    "creator_wallet",
    "unknown",
    "Creator wallet activity could not be verified.",
    "Creator activity unknown.",
  );
}

function mintAuthority(input: RuleInput): DraftFact {
  if (input.mintAuthorityActive == null) {
    return draft(
      "mint_authority",
      "unknown",
      "Mint authority could not be verified.",
      "Mint authority unknown.",
    );
  }
  if (input.mintAuthorityActive) {
    return draft(
      "mint_authority",
      "danger",
      "Mint authority is still on, so more tokens can be created.",
      "Mint authority is still on.",
    );
  }
  return draft("mint_authority", "good", "Mint authority is turned off.", "Mint authority is off.");
}

function freezeAuthority(input: RuleInput): DraftFact {
  if (input.freezeAuthorityActive == null) {
    return draft(
      "freeze_authority",
      "unknown",
      "Freeze authority could not be verified.",
      "Freeze authority unknown.",
    );
  }
  if (input.freezeAuthorityActive) {
    return draft(
      "freeze_authority",
      "danger",
      "Freeze authority is still on, so token accounts can be frozen.",
      "Freeze authority is still on.",
    );
  }
  return draft(
    "freeze_authority",
    "good",
    "Freeze authority is turned off.",
    "Freeze authority is off.",
  );
}

function snipers(input: RuleInput): DraftFact {
  if (input.sniperPct == null) {
    return draft(
      "snipers",
      "unknown",
      "Launch sniper wallets could not be verified.",
      "Sniper wallets unknown.",
    );
  }
  const share = pct(input.sniperPct);
  if (input.sniperPct >= SNIPER_DANGER_PCT) {
    return draft(
      "snipers",
      "danger",
      `Linked wallets that bought at launch hold about ${share} of supply.`,
      `Launch wallets hold ${share}.`,
    );
  }
  if (input.sniperPct >= SNIPER_CAUTION_PCT) {
    return draft(
      "snipers",
      "caution",
      `Linked wallets that bought at launch hold about ${share} of supply.`,
      `Launch wallets hold ${share}.`,
    );
  }
  return draft(
    "snipers",
    "good",
    `Launch buying looks spread out (about ${share} in linked early wallets).`,
    `Launch buying looks spread out.`,
  );
}

function claims(input: RuleInput): DraftFact | null {
  if (!input.claims.burned && !input.claims.locked) return null;
  const parts: DraftFact[] = [];
  if (input.claims.burned) {
    if (input.burnedPct == null) {
      parts.push(
        draft(
          "claims_burned",
          "unknown",
          "The post says tokens were burned. That could not be verified on-chain.",
          "Burn claim could not be verified.",
        ),
      );
    } else if (input.burnedPct < BURN_MATCH_PCT) {
      parts.push(
        draft(
          "claims_burned",
          "danger",
          `The post says tokens were burned, but on-chain data shows about ${pct(input.burnedPct)} burned.`,
          "Burn claim does not match the chain.",
        ),
      );
    } else {
      parts.push(
        draft(
          "claims_burned",
          "good",
          `The post says tokens were burned, and on-chain data shows about ${pct(input.burnedPct)} burned.`,
          "Burn claim matches the chain.",
        ),
      );
    }
  }
  if (input.claims.locked) {
    if (input.lpLocked == null) {
      parts.push(
        draft(
          "claims_locked",
          "unknown",
          "The post says liquidity is locked. That could not be verified on-chain.",
          "Lock claim could not be verified.",
        ),
      );
    } else if (!input.lpLocked) {
      parts.push(
        draft(
          "claims_locked",
          "danger",
          "The post says liquidity is locked, but no lock was found on-chain.",
          "Lock claim does not match the chain.",
        ),
      );
    } else {
      parts.push(
        draft(
          "claims_locked",
          "good",
          "The post says liquidity is locked, and that matches on-chain data.",
          "Lock claim matches the chain.",
        ),
      );
    }
  }
  const rank: Record<Signal, number> = { danger: 3, caution: 2, unknown: 1, good: 0 };
  const worst = parts.reduce((best, part) => (rank[part.signal] > rank[best.signal] ? part : best));
  const text = parts.map((part) => part.text).join(" ");
  const short = parts.map((part) => part.short).join(" ");
  return draft("claims", worst.signal, text, short);
}

const SOURCE_FOR: Record<string, "dex" | "scan"> = {
  coin_age: "dex",
  liquidity: "dex",
  top_holders: "scan",
  creator_wallet: "scan",
  mint_authority: "scan",
  freeze_authority: "scan",
  snipers: "scan",
  claims: "scan",
  incomplete: "scan",
};

export function attachSources(facts: Fact[], links: TokenLinks): Fact[] {
  return facts.map((fact) => {
    const kind = SOURCE_FOR[fact.id] ?? "scan";
    if (kind === "dex" && links.dexscreener) {
      return { ...fact, sourceUrl: links.dexscreener, sourceLabel: "DexScreener" };
    }
    if (links.solscan) {
      return { ...fact, sourceUrl: links.solscan, sourceLabel: "Solscan" };
    }
    return fact;
  });
}

export function emptyLinks(mint: string): TokenLinks {
  return {
    dexscreener: `https://dexscreener.com/solana/${mint}`,
    solscan: `https://solscan.io/token/${mint}`,
    birdeye: `https://birdeye.so/token/${mint}?chain=solana`,
  };
}

export function snapshotToRuleInput(snapshot: TokenSnapshot, claimsInput: Claims, now: Date): RuleInput {
  let coinAgeHours: number | null = null;
  if (snapshot.createdAt) {
    const created = Date.parse(snapshot.createdAt);
    if (!Number.isNaN(created)) {
      coinAgeHours = Math.max(0, (now.getTime() - created) / 3_600_000);
    }
  }
  return {
    coinAgeHours,
    liquidityUsd: snapshot.liquidityUsd,
    lpLocked: snapshot.lpLocked,
    top10HolderPct: snapshot.top10HolderPct,
    creatorSoldPct: snapshot.creatorSoldPct,
    creatorBalancePct: snapshot.creatorBalancePct,
    mintAuthorityActive: snapshot.mintAuthorityActive,
    freezeAuthorityActive: snapshot.freezeAuthorityActive,
    sniperPct: snapshot.sniperPct,
    burnedPct: snapshot.burnedPct,
    claims: claimsInput,
  };
}

export function evaluateRisk(input: RuleInput, links: TokenLinks = emptyLinks("")): RiskReport {
  const drafts = [
    coinAge(input),
    liquidity(input),
    topHolders(input),
    creator(input),
    mintAuthority(input),
    freezeAuthority(input),
    snipers(input),
    claims(input),
  ].filter((item): item is DraftFact => item != null);

  let score = 0;
  let dangerCount = 0;
  let cautionCount = 0;
  let unknownCount = 0;
  for (const item of drafts) {
    if (item.signal === "danger") {
      score += DANGER_WEIGHT;
      dangerCount += 1;
    } else if (item.signal === "caution") {
      score += CAUTION_WEIGHT;
      cautionCount += 1;
    } else if (item.signal === "unknown") {
      unknownCount += 1;
    }
  }

  let level: RiskLevel = "LOW";
  if (dangerCount >= HIGH_DANGER_COUNT || score >= HIGH_SCORE) level = "HIGH";
  else if (dangerCount >= 1 || cautionCount >= 2) level = "MEDIUM";

  const incomplete = level === "LOW" && unknownCount >= INCOMPLETE_UNKNOWN_COUNT;
  if (incomplete) level = "MEDIUM";

  const facts: Fact[] = drafts.map((item) => ({
    ...item,
    sourceUrl: null,
    sourceLabel: null,
  }));
  if (incomplete) {
    facts.push({
      id: "incomplete",
      signal: "unknown",
      text: "Several checks could not be verified, so this is not a clear pass.",
      short: "Several checks could not be verified.",
      sourceUrl: null,
      sourceLabel: null,
    });
  }

  return {
    level,
    score,
    dangerCount,
    cautionCount,
    unknownCount,
    incomplete,
    facts: attachSources(facts, links),
  };
}

export function levelSummary(level: RiskLevel): string {
  if (level === "HIGH") return "Several danger signs showed up.";
  if (level === "MEDIUM") return "Mixed signals. This is not a clear pass.";
  return "No major red flags found. That is not a prediction that the price will rise.";
}

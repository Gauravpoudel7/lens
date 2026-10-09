import { emptyLinks } from "../risk/engine.js";
import { CHECK_DATA_VERSION, type CheckRecord, type EditorialRecord, type TokenSnapshot } from "../types.js";

/** Test builders for the editorial suites. Not used by runtime code. */
export function snapshotFixture(mint: string, patch: Partial<TokenSnapshot> = {}): TokenSnapshot {
  return {
    mint,
    symbol: "COIN",
    name: "Coin",
    decimals: 6,
    createdAt: null,
    priceUsd: 0.01,
    liquidityUsd: 50_000,
    lpLocked: null,
    top10HolderPct: 30,
    creatorWallet: null,
    creatorSoldPct: null,
    creatorBalancePct: null,
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    sniperPct: null,
    burnedPct: null,
    links: emptyLinks(mint),
    sources: ["dexscreener"],
    ...patch,
  };
}

export function checkFixture(id: string, mint: string, patch: Partial<CheckRecord> = {}): CheckRecord {
  return {
    id,
    kind: "reply",
    mentionId: null,
    parentPostId: null,
    tokenMint: mint,
    tokenSymbol: "COIN",
    tokenName: "Coin",
    riskLevel: "LOW",
    score: 0,
    dangerCount: 0,
    cautionCount: 0,
    unknownCount: 0,
    facts: [],
    snapshot: snapshotFixture(mint),
    claims: { burned: false, locked: false },
    sources: [],
    dataMode: "live",
    replyText: "reply",
    sourcePostText: null,
    priceAtCheck: 0.01,
    askedBy: null,
    status: "published",
    error: null,
    xPostId: null,
    dataVersion: CHECK_DATA_VERSION,
    createdAt: "2026-10-09T10:00:00.000Z",
    proof: {
      contentHash: "h",
      signedAt: "2026-10-09T10:00:00.000Z",
      payload: "p",
      txSignature: `sig_${id}`,
      cluster: "devnet",
      status: "confirmed",
      explorerUrl: null,
    },
    outcome: null,
    ...patch,
  };
}

export function editorialFixture(patch: Partial<EditorialRecord> = {}): EditorialRecord {
  return {
    id: "e1",
    kind: "tip",
    day: "2026-10-09",
    text: "text",
    contentHash: "h",
    payload: "p",
    txSignature: "sig",
    cluster: "devnet",
    xPostId: null,
    status: "posted",
    recapSource: null,
    error: null,
    attempts: 0,
    createdAt: "2026-10-09T13:00:00.000Z",
    updatedAt: "2026-10-09T13:00:00.000Z",
    ...patch,
  };
}

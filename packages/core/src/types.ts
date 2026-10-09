export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type Signal = "danger" | "caution" | "good" | "unknown";

export type CheckKind =
  | "reply"
  | "call"
  | "warning"
  | "note"
  | "manual"
  | "blink"
  | "unresolved";

export interface Fact {
  id: string;
  signal: Signal;
  text: string;
  short: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
}

export interface Claims {
  burned: boolean;
  locked: boolean;
}

export interface TokenLinks {
  dexscreener: string | null;
  solscan: string | null;
  birdeye: string | null;
}

export interface TokenSnapshot {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  createdAt: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  /** Fully diluted value from the deepest real pool. Absent on older snapshots. */
  fdvUsd?: number | null;
  lpLocked: boolean | null;
  top10HolderPct: number | null;
  creatorWallet: string | null;
  creatorSoldPct: number | null;
  creatorBalancePct: number | null;
  mintAuthorityActive: boolean | null;
  mintAuthority?: string | null;
  freezeAuthorityActive: boolean | null;
  sniperPct: number | null;
  burnedPct: number | null;
  /** Token-2022 traps. Absent means the mint account was not read. */
  permanentDelegate?: boolean | null;
  transferFeeBps?: number | null;
  transferFeeUnsized?: boolean | null;
  transferHook?: boolean | null;
  defaultFrozen?: boolean | null;
  nonTransferable?: boolean | null;
  links: TokenLinks;
  sources: string[];
}

export interface RiskReport {
  level: RiskLevel;
  score: number;
  dangerCount: number;
  cautionCount: number;
  unknownCount: number;
  incomplete: boolean;
  facts: Fact[];
}

export type CallResult =
  | "win"
  | "loss"
  | "flat"
  | "correct"
  | "incorrect"
  | "n/a"
  | "unscored";

export interface ProofRecord {
  contentHash: string;
  signedAt: string;
  payload: string;
  txSignature: string | null;
  cluster: string;
  status: "confirmed" | "mocked" | "failed";
  explorerUrl: string | null;
}

export interface OutcomeRecord {
  priceAtCheck: number | null;
  priceAtScore: number | null;
  priceChangePct: number | null;
  windowDays: number;
  labelCorrect: boolean | null;
  callResult: CallResult;
  scoredAt: string;
}

/**
 * Bump when a data rule change means older checks should not be reused.
 * 2: real-pool liquidity, CLMM vaults as pools, plausibility gate (2026-10-09).
 */
export const CHECK_DATA_VERSION = 2;

export interface CheckRecord {
  id: string;
  kind: CheckKind;
  mentionId: string | null;
  parentPostId: string | null;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  riskLevel: RiskLevel | "NONE";
  score: number;
  dangerCount: number;
  cautionCount: number;
  unknownCount: number;
  facts: Fact[];
  snapshot: TokenSnapshot | null;
  claims: Claims;
  sources: string[];
  dataMode: "mock" | "live";
  replyText: string;
  sourcePostText: string | null;
  priceAtCheck: number | null;
  askedBy: string | null;
  /** `hidden` keeps the proof and report link but leaves the check off the public scorecard. */
  status: "published" | "reply_failed" | "hidden";
  error: string | null;
  xPostId: string | null;
  /** Data rules the check was made under. Absent or 1 means before the 2026-10-09 fixes. */
  dataVersion?: number;
  createdAt: string;
  proof: ProofRecord | null;
  outcome: OutcomeRecord | null;
}

export interface MentionRecord {
  id: string;
  xUserId: string;
  xUsername: string;
  parentPostId: string | null;
  text: string;
  parentText: string | null;
  status: "processing" | "replied" | "reply_failed" | "rate_limited" | "error";
  skipReason: string | null;
  checkId: string | null;
  createdAt: string;
}

export interface LensConfig {
  dataMode: "mock" | "live";
  proofMode: "mock" | "solana";
  xMode: "mock" | "live";
  llmMode: "auto" | "template";
  publicBaseUrl: string;
  /** Plain-text site name for link-free replies. Empty means omit the scorecard line. */
  publicSiteName?: string;
  /** The bot's X handle without @. */
  xBotHandle: string;
  solanaCluster: "devnet" | "mainnet-beta";
  solanaRpcUrl: string;
  dataRpcUrl: string;
  heliusApiKey?: string;
  birdeyeApiKey?: string;
  llmApiKey?: string;
  llmBaseUrl: string;
  llmModel: string;
  xAuthMode: "oauth1" | "oauth2";
  xApiKey?: string;
  xApiSecret?: string;
  xAccessToken?: string;
  xAccessSecret?: string;
  xBearerToken?: string;
  xBotUserId?: string;
  /** X posts include a URL only when this is true. Default false (Pay Per Use). */
  xReplyLinks: boolean;
  /**
   * When true, a mention that asks to buy, swap, or trade can include one Blink URL.
   * Default true. Still requires a public https PUBLIC_BASE_URL, and never on HIGH.
   */
  xSwapLinksOnRequest: boolean;
  xOauth2ClientId?: string;
  xOauth2ClientSecret?: string;
  xOauth2AccessToken?: string;
  xOauth2RefreshToken?: string;
  xOauth2RedirectUri: string;
  rateLimitPerUserPerDay: number;
  maxXRepliesPerDay: number;
  outcomeWindowDays: number;
  sharpDropPct: number;
  callWinPct: number;
  pollIntervalMs: number;
  /** Minimum gap between DM reads for link codes. Floor 180000. */
  xDmPollMs: number;
  jupiterFeeBps: number;
  jupiterFeeAccount?: string;
  jupiterApiKey?: string;
  jupiterBaseUrl: string;
  solanaKeypair?: string;
  solanaKeypairPath?: string;
  /** Pubkey that must have signed a chain memo. Falls back to the proof keypair. */
  proofSigner?: string;
  outboundEnabled: boolean;
  outboundMints: string[];
  outboundDailyCap: number;
  outboundDiscover: boolean;
  checkApiLimitPerHour: number;
  rpcRetryAttempts: number;
  proPriceUsdc: number;
  proPeriodDays: number;
  /** Unpaid Solana Pay checkouts older than this are reported as expired. A full transfer still confirms. */
  proCheckoutTtlHours: number;
  proTreasury?: string;
  proRpcUrl: string;
  usdcMint: string;
  /** Warning DMs: per Pro watcher and bot-wide, per UTC day. */
  alertDmsPerUserPerDay: number;
  alertDmsPerDay: number;
  /** HMAC key for the 24 h wallet session cookie. Unset means a random key per process. */
  sessionSecret?: string;
}

export type EditorialKind = "tip" | "term" | "recap";

export type EditorialStatus = "proved" | "posted" | "post_failed" | "duplicate" | "skipped";

export interface EditorialRecord {
  id: string;
  kind: EditorialKind;
  /** UTC yyyy-mm-dd of the slot. */
  day: string;
  text: string;
  contentHash: string;
  payload: string;
  txSignature: string | null;
  cluster: string;
  xPostId: string | null;
  status: EditorialStatus;
  recapSource: "activity" | "market" | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

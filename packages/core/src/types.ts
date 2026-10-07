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
  status: "published" | "reply_failed";
  error: string | null;
  xPostId: string | null;
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
  jupiterFeeBps: number;
  jupiterFeeAccount?: string;
  jupiterApiKey?: string;
  jupiterBaseUrl: string;
  solanaKeypair?: string;
  solanaKeypairPath?: string;
  outboundEnabled: boolean;
  outboundMints: string[];
  outboundDailyCap: number;
  outboundDiscover: boolean;
  checkApiLimitPerHour: number;
  rpcRetryAttempts: number;
  proPriceUsdc: number;
  proPeriodDays: number;
  proTreasury?: string;
  proRpcUrl: string;
  usdcMint: string;
}

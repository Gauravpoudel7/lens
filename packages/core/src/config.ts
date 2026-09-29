import type { LensConfig } from "./types.js";

export const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

function num(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): LensConfig {
  const cluster = env.SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";
  const heliusApiKey = clean(env.HELIUS_API_KEY);
  const dataRpcUrl =
    clean(env.DATA_RPC_URL) ??
    (heliusApiKey
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
      : "https://api.mainnet-beta.solana.com");
  const solanaRpcUrl =
    clean(env.SOLANA_RPC_URL) ??
    (cluster === "devnet" ? "https://api.devnet.solana.com" : dataRpcUrl);

  return {
    dataMode: env.DATA_MODE === "live" ? "live" : "mock",
    proofMode: env.PROOF_MODE === "solana" ? "solana" : "mock",
    xMode: env.X_MODE === "live" ? "live" : "mock",
    llmMode: env.LLM_MODE === "template" ? "template" : "auto",
    publicBaseUrl: (env.PUBLIC_BASE_URL ?? "http://127.0.0.1:3847").replace(/\/$/, ""),
    solanaCluster: cluster,
    solanaRpcUrl,
    dataRpcUrl,
    heliusApiKey,
    birdeyeApiKey: clean(env.BIRDEYE_API_KEY),
    llmApiKey: clean(env.LLM_API_KEY) ?? clean(env.OPENAI_API_KEY),
    llmBaseUrl: (env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    llmModel: env.LLM_MODEL?.trim() || "gpt-4o-mini",
    xApiKey: clean(env.X_API_KEY),
    xApiSecret: clean(env.X_API_SECRET),
    xAccessToken: clean(env.X_ACCESS_TOKEN),
    xAccessSecret: clean(env.X_ACCESS_SECRET),
    xBearerToken: clean(env.X_BEARER_TOKEN),
    xBotUserId: clean(env.X_BOT_USER_ID),
    rateLimitPerUserPerDay: num(env.RATE_LIMIT_PER_USER_PER_DAY, 5),
    outcomeWindowDays: num(env.OUTCOME_WINDOW_DAYS, 7),
    sharpDropPct: num(env.SHARP_DROP_PCT, -30),
    callWinPct: num(env.CALL_WIN_PCT, 20),
    pollIntervalMs: num(env.POLL_INTERVAL_MS, 60_000),
    jupiterFeeBps: num(env.JUPITER_FEE_BPS, 50),
    jupiterFeeAccount: clean(env.JUPITER_FEE_ACCOUNT),
    jupiterBaseUrl: (env.JUPITER_BASE_URL ?? "https://lite-api.jup.ag").replace(/\/$/, ""),
    solanaKeypair: clean(env.SOLANA_KEYPAIR),
    solanaKeypairPath: clean(env.SOLANA_KEYPAIR_PATH),
    outboundEnabled: env.OUTBOUND_ENABLED === "true",
    outboundMints: (env.OUTBOUND_MINTS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    outboundDailyCap: Math.max(0, Math.floor(num(env.OUTBOUND_DAILY_CAP, 8))),
    outboundDiscover: env.OUTBOUND_DISCOVER === "true",
    checkApiLimitPerHour: num(env.CHECK_API_LIMIT_PER_HOUR, 30),
    rpcRetryAttempts: Math.max(1, Math.floor(num(env.RPC_RETRY_ATTEMPTS, 4))),
    proPriceUsdc: num(env.PRO_PRICE_USDC, 10),
    proPeriodDays: Math.max(1, Math.floor(num(env.PRO_PERIOD_DAYS, 30))),
    proTreasury: clean(env.PRO_TREASURY_WALLET),
    proRpcUrl: clean(env.PRO_RPC_URL) ?? dataRpcUrl,
    usdcMint: clean(env.USDC_MINT) ?? USDC_MINT_MAINNET,
  };
}

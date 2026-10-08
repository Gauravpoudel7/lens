import { DEFAULTS } from "@lens/core/defaults";

const trim = (url: string) => url.replace(/\/+$/, "");
const dev = process.env.NODE_ENV !== "production";

/** Local defaults keep `npm run dev:landing` working. A production build must name the real URLs. */
function url(name: string, value: string | undefined, local: string): string {
  if (value?.trim()) return trim(value.trim());
  if (dev) return local;
  throw new Error(`${name} must be set for a production build of the landing page.`);
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value?.trim() && Number.isFinite(parsed) ? parsed : fallback;
}

// NEXT_PUBLIC_* values are inlined at build time, so each one is read by its literal name.
export const SITE_URL = url("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL, "http://127.0.0.1:3848");
/** The scorecard app (apps/web): record, report, verify, and Pro links point here. */
export const APP_URL = url("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL, "http://127.0.0.1:3847");
export const X_HANDLE = (process.env.NEXT_PUBLIC_X_HANDLE || DEFAULTS.xBotHandle).replace(/^@/, "");
export const X_URL = `https://x.com/${X_HANDLE}`;
/** Public source repository. The footer link is hidden when this is empty. */
export const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL?.trim() || null;

// Same names and defaults as the app's PRO_PRICE_USDC, PRO_PERIOD_DAYS, RATE_LIMIT_PER_USER_PER_DAY,
// JUPITER_FEE_BPS, and SOLANA_CLUSTER. Set the NEXT_PUBLIC_ copies when you change those.
export const PRO_PRICE_USDC = num(process.env.NEXT_PUBLIC_PRO_PRICE_USDC, DEFAULTS.proPriceUsdc);
export const PRO_PERIOD_DAYS = num(process.env.NEXT_PUBLIC_PRO_PERIOD_DAYS, DEFAULTS.proPeriodDays);
export const FREE_CHECKS_PER_DAY = num(process.env.NEXT_PUBLIC_FREE_CHECKS_PER_DAY, DEFAULTS.rateLimitPerUserPerDay);
export const SWAP_FEE_BPS = num(process.env.NEXT_PUBLIC_SWAP_FEE_BPS, DEFAULTS.jupiterFeeBps);
export const PROOF_CLUSTER = process.env.NEXT_PUBLIC_PROOF_CLUSTER === "mainnet-beta" ? "Mainnet" : "Devnet";

export function appUrl(path = "") {
  return `${APP_URL}${path}`;
}

import { isActivePro, type PaymentRecord, type UserRecord } from "../accounts.js";
import { newId } from "../ids.js";
import type { LensConfig } from "../types.js";
import type { LensStore } from "../store/types.js";
import {
  createCardRail,
  newReference,
  paymentSatisfied,
  solanaPayUrl,
  usdcRaw,
  type CheckoutSession,
  type PaymentChain,
  type PaymentRail,
} from "./solana-pay.js";

export interface BillingDeps {
  config: Pick<
    LensConfig,
    "proPriceUsdc" | "proPeriodDays" | "proTreasury" | "usdcMint" | "publicBaseUrl"
  >;
  store: LensStore;
  chain: PaymentChain;
}

export async function startUsdcCheckout(
  deps: BillingDeps,
  input: { xHandle?: string | null; wallet?: string | null },
): Promise<{ ok: true; session: CheckoutSession; user: UserRecord } | { ok: false; error: string }> {
  const handle = input.xHandle?.trim() ?? "";
  const wallet = input.wallet?.trim() ?? "";
  if (!handle && !wallet) {
    return { ok: false, error: "Add an X handle, a wallet, or both." };
  }
  if (!deps.config.proTreasury) {
    return { ok: false, error: "Set PRO_TREASURY_WALLET to the wallet that should receive USDC." };
  }
  if (deps.config.proPriceUsdc <= 0) {
    return { ok: false, error: "PRO_PRICE_USDC must be greater than zero." };
  }
  const user = await deps.store.upsertUser({
    xHandle: handle || null,
    wallet: wallet || null,
  });
  const reference = newReference();
  const amountRaw = usdcRaw(deps.config.proPriceUsdc).toString();
  const payment: PaymentRecord = {
    id: newId(),
    userId: user.id,
    provider: "solana_usdc",
    reference,
    amountUsd: deps.config.proPriceUsdc,
    amountRaw,
    mint: deps.config.usdcMint,
    recipient: deps.config.proTreasury,
    signature: null,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await deps.store.savePayment(payment);
  const session: CheckoutSession = {
    rail: "solana_usdc",
    reference,
    amountUsd: payment.amountUsd,
    amountRaw,
    recipient: payment.recipient,
    splToken: payment.mint,
    solanaPayUrl: solanaPayUrl({
      recipient: payment.recipient,
      amountUsd: payment.amountUsd,
      splToken: payment.mint,
      reference,
      message: `Lens Pro for ${deps.config.proPeriodDays} days`,
    }),
  };
  return { ok: true, session, user };
}

export async function confirmUsdcCheckout(
  deps: BillingDeps,
  reference: string,
  now = new Date(),
): Promise<
  | { ok: true; user: UserRecord; signature: string; already: boolean }
  | { ok: false; error: string }
> {
  const payment = await deps.store.getPaymentByReference(reference.trim());
  if (!payment) return { ok: false, error: "No checkout exists for that reference." };
  if (payment.provider !== "solana_usdc") {
    return { ok: false, error: "That checkout is not a USDC transfer." };
  }
  const user = await deps.store.getUser(payment.userId);
  if (!user) return { ok: false, error: "The account for that checkout is missing." };
  if (payment.status === "paid" && payment.signature) {
    return { ok: true, user, signature: payment.signature, already: true };
  }
  const observed = await deps.chain.findPayments(payment.reference);
  const match = observed.find((row) => paymentSatisfied({ payment, observed: row }));
  if (!match) {
    return {
      ok: false,
      error: "No confirmed USDC transfer to the treasury includes this reference yet.",
    };
  }
  await deps.store.updatePayment(payment.id, { status: "paid", signature: match.signature });
  const until = new Date(now.getTime() + deps.config.proPeriodDays * 24 * 60 * 60 * 1000);
  const pro = await deps.store.setProUntil(user.id, until.toISOString());
  return { ok: true, user: pro, signature: match.signature, already: false };
}

export function cardRail(): PaymentRail {
  return createCardRail();
}

export function proStatus(user: UserRecord | null, now = new Date()): { tier: "free" | "pro"; proUntil: string | null } {
  if (isActivePro(user, now)) return { tier: "pro", proUntil: user?.proUntil ?? null };
  return { tier: "free", proUntil: user?.proUntil ?? null };
}

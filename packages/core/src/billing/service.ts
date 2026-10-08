import { isActivePro, type PaymentRecord, type UserRecord } from "../accounts.js";
import { isSolanaAddress } from "../discover.js";
import { logError, newId } from "../ids.js";
import type { LensConfig } from "../types.js";
import type { LensStore } from "../store/types.js";
import {
  deltaFor,
  newReference,
  paymentSatisfied,
  solanaPayUrl,
  usdcRaw,
  type CheckoutSession,
  type PaymentChain,
  type ReferencePayment,
} from "./solana-pay.js";

export type ConfirmFailureReason =
  | "not_found"
  | "not_usdc"
  | "account_missing"
  | "expired"
  | "wrong_amount"
  | "pending"
  | "reused_signature";

export interface BillingDeps {
  config: Pick<
    LensConfig,
    | "proPriceUsdc"
    | "proPeriodDays"
    | "proCheckoutTtlHours"
    | "proTreasury"
    | "usdcMint"
    | "publicBaseUrl"
  >;
  store: LensStore;
  chain: PaymentChain;
}

/**
 * Pro is bought by wallet. An X account is linked afterwards, only by DMing the code the wallet owner
 * sees on /account, so checkout never attaches a handle or wallet to someone else's record.
 */
export async function startUsdcCheckout(
  deps: BillingDeps,
  input: { wallet?: string | null; xHandle?: string | null },
): Promise<{ ok: true; session: CheckoutSession; user: UserRecord } | { ok: false; error: string }> {
  const wallet = input.wallet?.trim() ?? "";
  if (input.xHandle?.trim()) {
    return { ok: false, error: "Pro is bought by wallet. Link your X account after payment." };
  }
  if (!wallet) return { ok: false, error: "Add the wallet you will pay from." };
  if (!isSolanaAddress(wallet)) {
    return { ok: false, error: "That wallet address is not valid." };
  }
  if (!deps.config.proTreasury) {
    logError("pro checkout refused", { detail: "PRO_TREASURY_WALLET is not set" });
    return { ok: false, error: "Payments are not open yet. Try again later." };
  }
  if (deps.config.proPriceUsdc <= 0) {
    logError("pro checkout refused", { detail: "PRO_PRICE_USDC must be greater than zero" });
    return { ok: false, error: "Payments are not open yet. Try again later." };
  }
  const user = (await deps.store.findUser({ wallet })) ?? (await deps.store.upsertUser({ wallet }));
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

function fail(
  error: string,
  reason: ConfirmFailureReason,
): { ok: false; error: string; reason: ConfirmFailureReason } {
  return { ok: false, error, reason };
}

function referenceSeen(payment: PaymentRecord, observed: ReferencePayment): boolean {
  return observed.accountKeys.includes(payment.reference);
}

export async function confirmUsdcCheckout(
  deps: BillingDeps,
  reference: string,
  now = new Date(),
): Promise<
  | { ok: true; user: UserRecord; signature: string; already: boolean }
  | { ok: false; error: string; reason: ConfirmFailureReason }
> {
  const payment = await deps.store.getPaymentByReference(reference.trim());
  if (!payment) return fail("No checkout exists for that reference.", "not_found");
  if (payment.provider !== "solana_usdc") {
    return fail("That checkout is not a USDC transfer.", "not_usdc");
  }
  const user = await deps.store.getUser(payment.userId);
  if (!user) return fail("The account for that checkout is missing.", "account_missing");
  if (payment.status === "paid" && payment.signature) {
    return { ok: true, user, signature: payment.signature, already: true };
  }
  const observed = await deps.chain.findPayments(payment.reference);
  const match = observed.find((row) => paymentSatisfied({ payment, observed: row }));
  if (match) {
    const prior = await deps.store.findPaymentBySignature(match.signature);
    if (prior && prior.id !== payment.id) {
      return fail("That transaction was already used for another checkout.", "reused_signature");
    }
    await deps.store.updatePayment(payment.id, { status: "paid", signature: match.signature });
    const periodMs = deps.config.proPeriodDays * 24 * 60 * 60 * 1000;
    const currentEnd = user.proUntil ? Date.parse(user.proUntil) : Number.NaN;
    const base = Math.max(now.getTime(), Number.isFinite(currentEnd) ? currentEnd : 0);
    const until = new Date(base + periodMs);
    const pro = await deps.store.setProUntil(user.id, until.toISOString());
    return { ok: true, user: pro, signature: match.signature, already: false };
  }
  const short = observed.find((row) => {
    if (!referenceSeen(payment, row)) return false;
    return deltaFor(row, payment.recipient, payment.mint) < BigInt(payment.amountRaw);
  });
  if (short) {
    return fail(
      "A transfer with this reference reached the treasury, but the USDC amount is less than the price.",
      "wrong_amount",
    );
  }
  if (checkoutExpired(payment, deps.config.proCheckoutTtlHours, now)) {
    return fail("This checkout has expired. Start a new one and pay that reference.", "expired");
  }
  return fail("No confirmed USDC transfer to the treasury includes this reference yet.", "pending");
}

export function checkoutExpired(payment: Pick<PaymentRecord, "createdAt">, ttlHours: number, now = new Date()): boolean {
  const created = Date.parse(payment.createdAt);
  const ageMs = Number.isFinite(created) ? now.getTime() - created : 0;
  return ageMs > ttlHours * 60 * 60 * 1000;
}

export function proStatus(user: UserRecord | null, now = new Date()): { tier: "free" | "pro"; proUntil: string | null } {
  if (isActivePro(user, now)) return { tier: "pro", proUntil: user?.proUntil ?? null };
  return { tier: "free", proUntil: user?.proUntil ?? null };
}

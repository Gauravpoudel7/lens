import { Keypair } from "@solana/web3.js";
import type { PaymentRecord } from "../accounts.js";

export const USDC_DECIMALS = 6;

export interface TokenAmountRow {
  owner: string;
  mint: string;
  amount: string;
}

export interface ReferencePayment {
  signature: string;
  accountKeys: string[];
  pre: TokenAmountRow[];
  post: TokenAmountRow[];
}

export interface PaymentChain {
  findPayments(reference: string): Promise<ReferencePayment[]>;
}

export interface CheckoutSession {
  rail: "solana_usdc" | "card";
  reference: string;
  amountUsd: number;
  amountRaw: string;
  recipient?: string;
  splToken?: string;
  solanaPayUrl?: string;
  checkoutUrl?: string;
}

export interface PaymentRail {
  readonly id: "solana_usdc" | "card";
  createCheckout(input: { userId: string; amountUsd: number }): Promise<CheckoutSession>;
  confirm(reference: string): Promise<{ ok: true; signature: string } | { ok: false; reason: string }>;
}

export function usdcRaw(amountUsd: number): bigint {
  return BigInt(Math.round(amountUsd * 10 ** USDC_DECIMALS));
}

export function newReference(): string {
  return Keypair.generate().publicKey.toBase58();
}

export function solanaPayUrl(input: {
  recipient: string;
  amountUsd: number;
  splToken: string;
  reference: string;
  label?: string;
  message?: string;
}): string {
  const params = new URLSearchParams({
    amount: input.amountUsd.toFixed(USDC_DECIMALS),
    "spl-token": input.splToken,
    reference: input.reference,
    label: input.label ?? "Lens Pro",
    message: input.message ?? "Lens Pro",
  });
  return `solana:${input.recipient}?${params.toString()}`;
}

export function paymentSatisfied(input: {
  payment: Pick<PaymentRecord, "reference" | "recipient" | "mint" | "amountRaw">;
  observed: ReferencePayment;
}): boolean {
  if (!input.observed.accountKeys.includes(input.payment.reference)) return false;
  const minRaw = BigInt(input.payment.amountRaw);
  const received = deltaFor(input.observed, input.payment.recipient, input.payment.mint);
  return received >= minRaw;
}

export function deltaFor(observed: ReferencePayment, owner: string, mint: string): bigint {
  const pre = sumAmount(observed.pre, owner, mint);
  const post = sumAmount(observed.post, owner, mint);
  return post - pre;
}

function sumAmount(rows: TokenAmountRow[], owner: string, mint: string): bigint {
  let total = 0n;
  for (const row of rows) {
    if (row.owner === owner && row.mint === mint) total += BigInt(row.amount);
  }
  return total;
}

export function parseParsedTransaction(
  tx: unknown,
): { accountKeys: string[]; pre: TokenAmountRow[]; post: TokenAmountRow[] } | null {
  if (!tx || typeof tx !== "object") return null;
  const record = tx as {
    transaction?: { message?: { accountKeys?: unknown } };
    meta?: {
      preTokenBalances?: unknown;
      postTokenBalances?: unknown;
      loadedAddresses?: { writable?: string[]; readonly?: string[] };
    };
  };
  const keys = accountKeysFrom(record.transaction?.message?.accountKeys);
  const loaded = record.meta?.loadedAddresses;
  if (loaded?.writable) keys.push(...loaded.writable);
  if (loaded?.readonly) keys.push(...loaded.readonly);
  return {
    accountKeys: keys,
    pre: tokenRows(record.meta?.preTokenBalances),
    post: tokenRows(record.meta?.postTokenBalances),
  };
}

function accountKeysFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys: string[] = [];
  for (const item of value) {
    if (typeof item === "string") keys.push(item);
    else if (item && typeof item === "object" && typeof (item as { pubkey?: string }).pubkey === "string") {
      keys.push((item as { pubkey: string }).pubkey);
    }
  }
  return keys;
}

function tokenRows(value: unknown): TokenAmountRow[] {
  if (!Array.isArray(value)) return [];
  const rows: TokenAmountRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      owner?: string;
      mint?: string;
      uiTokenAmount?: { amount?: string };
    };
    if (!row.owner || !row.mint || !row.uiTokenAmount?.amount) continue;
    rows.push({ owner: row.owner, mint: row.mint, amount: row.uiTokenAmount.amount });
  }
  return rows;
}

export function createCardRail(): PaymentRail {
  return {
    id: "card",
    async createCheckout() {
      throw new Error("Card checkout is not configured. Pay with USDC on Solana.");
    },
    async confirm() {
      return { ok: false, reason: "card_not_configured" };
    },
  };
}

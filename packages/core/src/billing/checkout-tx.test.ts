import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { USDC_MINT_MAINNET, loadConfig } from "../config.js";
import { SPL_TOKEN_PROGRAM_ID } from "../providers/parse.js";
import { MemoryStore } from "../store/memory.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  associatedTokenAddress,
  prepareCheckoutTx,
  type CheckoutChainReader,
} from "./checkout-tx.js";
import { startUsdcCheckout } from "./service.js";
import type { PaymentChain } from "./solana-pay.js";

const treasury = "6bzZwnSvBLur1xr9baRyHZ3Ck4GgiUCUZf8YQ3oXBEm5";
const payer = Keypair.generate().publicKey.toBase58();
const blockhash = Keypair.generate().publicKey.toBase58();
const mint = new PublicKey(USDC_MINT_MAINNET);
const TOKEN_PROGRAM_ID = new PublicKey(SPL_TOKEN_PROGRAM_ID);
const chain: PaymentChain = { findPayments: async () => [] };

function config() {
  return loadConfig({
    PRO_TREASURY_WALLET: treasury,
    PRO_PRICE_USDC: "10",
    PRO_CHECKOUT_TTL_HOURS: "24",
    USDC_MINT: USDC_MINT_MAINNET,
  });
}

function reader(
  input: { usdc?: bigint; lamports?: bigint; treasuryAta?: boolean; network?: "devnet" | "unknown"; simError?: string } = {},
): CheckoutChainReader {
  const treasuryAta = associatedTokenAddress(new PublicKey(treasury), mint, TOKEN_PROGRAM_ID).toBase58();
  return {
    network: async () => input.network ?? "devnet",
    simulate: async () => ({ error: input.simError ?? null }),
    accountOwner: async (address) => {
      if (address === USDC_MINT_MAINNET) return TOKEN_PROGRAM_ID.toBase58();
      if (address === treasuryAta) return input.treasuryAta === false ? null : TOKEN_PROGRAM_ID.toBase58();
      return null;
    },
    lamports: async () => input.lamports ?? 1_000_000_000n,
    tokenAmount: async () => input.usdc ?? 50_000_000n,
    latestBlockhash: async () => blockhash,
  };
}

async function setup(wallet = payer) {
  const store = new MemoryStore();
  const cfg = config();
  const started = await startUsdcCheckout({ config: cfg, store, chain }, { wallet });
  if (!started.ok) throw new Error(started.error);
  return { store, cfg, reference: started.session.reference };
}

function decode(base64: string): Transaction {
  return Transaction.from(Buffer.from(base64, "base64"));
}

describe("checkout transaction", () => {
  it("builds a TransferChecked of the exact price to the treasury ATA with the reference key", async () => {
    const { store, cfg, reference } = await setup();
    const result = await prepareCheckoutTx({ config: cfg, store, reader: reader() }, { reference, account: payer });
    expect(result).toMatchObject({ ok: true, network: "devnet" });
    if (!result.ok) return;
    const tx = decode(result.transaction);
    expect(tx.feePayer?.toBase58()).toBe(payer);
    expect(tx.recentBlockhash).toBe(blockhash);
    expect(tx.instructions).toHaveLength(1);
    const [transfer] = tx.instructions;
    expect(transfer!.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
    const data = Buffer.from(transfer!.data);
    expect(data[0]).toBe(12);
    expect(data.readBigUInt64LE(1)).toBe(10_000_000n);
    expect(data[9]).toBe(6);
    const keys = transfer!.keys.map((key) => key.pubkey.toBase58());
    expect(keys[0]).toBe(associatedTokenAddress(new PublicKey(payer), mint, TOKEN_PROGRAM_ID).toBase58());
    expect(keys[1]).toBe(USDC_MINT_MAINNET);
    expect(keys[2]).toBe(associatedTokenAddress(new PublicKey(treasury), mint, TOKEN_PROGRAM_ID).toBase58());
    expect(keys[3]).toBe(payer);
    const ref = transfer!.keys.find((key) => key.pubkey.toBase58() === reference);
    expect(ref).toMatchObject({ isSigner: false, isWritable: false });
  });

  it("creates the treasury ATA idempotently only when it is missing", async () => {
    const { store, cfg, reference } = await setup();
    const result = await prepareCheckoutTx(
      { config: cfg, store, reader: reader({ treasuryAta: false }) },
      { reference, account: payer },
    );
    if (!result.ok) throw new Error(result.error);
    const tx = decode(result.transaction);
    expect(tx.instructions).toHaveLength(2);
    const create = tx.instructions[0]!;
    expect(create.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
    expect([...create.data]).toEqual([1]);
    expect(create.keys[1]!.pubkey.toBase58()).toBe(
      associatedTokenAddress(new PublicKey(treasury), mint, TOKEN_PROGRAM_ID).toBase58(),
    );
    expect(create.keys[2]!.pubkey.toBase58()).toBe(treasury);
  });

  it("rejects unknown, expired, paid, and mismatched checkouts", async () => {
    const { store, cfg, reference } = await setup();
    const deps = { config: cfg, store, reader: reader() };
    expect(await prepareCheckoutTx(deps, { reference: "missing", account: payer })).toMatchObject({
      reason: "not_found",
    });
    expect(await prepareCheckoutTx(deps, { reference, account: "not-a-key" })).toMatchObject({
      reason: "invalid_account",
    });
    expect(
      await prepareCheckoutTx(deps, { reference, account: Keypair.generate().publicKey.toBase58() }),
    ).toMatchObject({ reason: "wrong_wallet" });
    const later = new Date(Date.now() + 25 * 60 * 60 * 1000);
    expect(await prepareCheckoutTx(deps, { reference, account: payer }, later)).toMatchObject({ reason: "expired" });
    const payment = await store.getPaymentByReference(reference);
    await store.updatePayment(payment!.id, { status: "paid", signature: "sig" });
    expect(await prepareCheckoutTx(deps, { reference, account: payer })).toMatchObject({ reason: "already_paid" });
  });

  it("names the network when the payer lacks USDC or SOL", async () => {
    const { store, cfg, reference } = await setup();
    const poor = await prepareCheckoutTx(
      { config: cfg, store, reader: reader({ usdc: 9_999_999n }) },
      { reference, account: payer },
    );
    expect(poor).toMatchObject({ ok: false, reason: "insufficient_usdc" });
    if (!poor.ok) expect(poor.error).toContain("9.99 USDC on devnet");
    const noFee = await prepareCheckoutTx(
      { config: cfg, store, reader: reader({ lamports: 0n }) },
      { reference, account: payer },
    );
    expect(noFee).toMatchObject({ ok: false, reason: "insufficient_sol" });
    // Creating the treasury ATA costs rent on top of the fee.
    const noRent = await prepareCheckoutTx(
      { config: cfg, store, reader: reader({ lamports: 100_000n, treasuryAta: false }) },
      { reference, account: payer },
    );
    expect(noRent).toMatchObject({ ok: false, reason: "insufficient_sol" });
  });

  it("refuses a transfer that fails simulation or an unknown network", async () => {
    const { store, cfg, reference } = await setup();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = await prepareCheckoutTx(
      { config: cfg, store, reader: reader({ simError: '{"InstructionError":[0,"Custom"]}' }) },
      { reference, account: payer },
    );
    expect(failed).toMatchObject({ ok: false, reason: "simulation_failed" });
    if (!failed.ok) expect(failed.error).not.toContain("InstructionError");
    const unknown = await prepareCheckoutTx(
      { config: cfg, store, reader: reader({ network: "unknown" }) },
      { reference, account: payer },
    );
    expect(unknown).toMatchObject({ ok: false, reason: "config" });
    spy.mockRestore();
  });
});

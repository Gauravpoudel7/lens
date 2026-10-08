import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { isSolanaAddress } from "../discover.js";
import { SPL_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "../providers/parse.js";
import type { LensConfig } from "../types.js";
import type { LensStore } from "../store/types.js";
import { checkoutExpired } from "./service.js";
import { USDC_DECIMALS } from "./solana-pay.js";

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

/** One signature. */
const FEE_LAMPORTS = 10_000;
/** Rent-exempt minimum for a 165-byte token account, paid when the treasury ATA is created. */
const TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280;

export type SolanaNetwork = "mainnet-beta" | "devnet" | "unknown";

/** Read-only RPC calls the checkout transaction needs. `createRpcCheckoutReader` is the live one. */
export interface CheckoutChainReader {
  network(): Promise<SolanaNetwork>;
  /** Program that owns the account, or null when the account does not exist. */
  accountOwner(address: string): Promise<string | null>;
  lamports(address: string): Promise<bigint>;
  /** Raw token amount, 0n when the token account does not exist. */
  tokenAmount(address: string): Promise<bigint>;
  latestBlockhash(): Promise<string>;
}

export type CheckoutTxFailureReason =
  | "invalid_account"
  | "not_found"
  | "already_paid"
  | "expired"
  | "wrong_wallet"
  | "config"
  | "insufficient_usdc"
  | "insufficient_sol";

export function associatedTokenAddress(owner: PublicKey, mint: PublicKey, tokenProgram: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

/**
 * The Solana Pay transfer `paymentSatisfied` accepts: an SPL `TransferChecked` of `amountRaw` to the treasury's
 * associated token account, with `reference` as a read-only non-signer key on that instruction.
 */
export function buildUsdcTransferTx(input: {
  payer: PublicKey;
  treasury: PublicKey;
  mint: PublicKey;
  tokenProgram: PublicKey;
  amountRaw: bigint;
  reference: PublicKey;
  blockhash: string;
  createTreasuryAta: boolean;
}): Transaction {
  const source = associatedTokenAddress(input.payer, input.mint, input.tokenProgram);
  const destination = associatedTokenAddress(input.treasury, input.mint, input.tokenProgram);
  const tx = new Transaction({ feePayer: input.payer, recentBlockhash: input.blockhash });
  if (input.createTreasuryAta) {
    tx.add(
      new TransactionInstruction({
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: input.payer, isSigner: true, isWritable: true },
          { pubkey: destination, isSigner: false, isWritable: true },
          { pubkey: input.treasury, isSigner: false, isWritable: false },
          { pubkey: input.mint, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: input.tokenProgram, isSigner: false, isWritable: false },
        ],
        // CreateIdempotent
        data: Buffer.from([1]),
      }),
    );
  }
  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0); // TransferChecked
  data.writeBigUInt64LE(input.amountRaw, 1);
  data.writeUInt8(USDC_DECIMALS, 9);
  tx.add(
    new TransactionInstruction({
      programId: input.tokenProgram,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: input.mint, isSigner: false, isWritable: false },
        { pubkey: destination, isSigner: false, isWritable: true },
        { pubkey: input.payer, isSigner: true, isWritable: false },
        { pubkey: input.reference, isSigner: false, isWritable: false },
      ],
      data,
    }),
  );
  return tx;
}

function networkName(network: SolanaNetwork): string {
  if (network === "mainnet-beta") return "mainnet";
  if (network === "devnet") return "devnet";
  return "this network";
}

function shortKey(value: string): string {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function usdc(raw: bigint): string {
  const whole = raw / 10n ** BigInt(USDC_DECIMALS);
  const cents = (raw % 10n ** BigInt(USDC_DECIMALS)) / 10n ** BigInt(USDC_DECIMALS - 2);
  return `${whole}.${cents.toString().padStart(2, "0")}`;
}

function fail(reason: CheckoutTxFailureReason, error: string) {
  return { ok: false as const, reason, error };
}

/** Builds the unsigned transfer for an open checkout, after checking the payer can afford it on the Pro network. */
export async function prepareCheckoutTx(
  deps: {
    config: Pick<LensConfig, "proCheckoutTtlHours">;
    store: LensStore;
    reader: CheckoutChainReader;
  },
  input: { reference?: string | null; account?: string | null },
  now = new Date(),
): Promise<
  | { ok: true; transaction: string; network: SolanaNetwork }
  | { ok: false; reason: CheckoutTxFailureReason; error: string }
> {
  const account = input.account?.trim() ?? "";
  if (!isSolanaAddress(account)) return fail("invalid_account", "The wallet address is not valid.");
  const payment = await deps.store.getPaymentByReference(input.reference?.trim() ?? "");
  if (!payment || payment.provider !== "solana_usdc") {
    return fail("not_found", "No checkout exists for that reference.");
  }
  if (payment.status === "paid") return fail("already_paid", "This checkout is already paid.");
  if (checkoutExpired(payment, deps.config.proCheckoutTtlHours, now)) {
    return fail("expired", "This checkout has expired. Start a new one.");
  }
  const user = await deps.store.getUser(payment.userId);
  if (!user?.wallet) return fail("not_found", "The account for that checkout is missing.");
  if (user.wallet !== account) {
    return fail(
      "wrong_wallet",
      `Connect the wallet you entered (${shortKey(user.wallet)}), or start over with this one.`,
    );
  }

  const network = await deps.reader.network();
  const where = networkName(network);
  const mintOwner = await deps.reader.accountOwner(payment.mint);
  if (mintOwner !== SPL_TOKEN_PROGRAM_ID && mintOwner !== TOKEN_2022_PROGRAM_ID) {
    return fail("config", `The USDC mint is not a token on ${where}. Check USDC_MINT.`);
  }
  const tokenProgram = new PublicKey(mintOwner);

  const payer = new PublicKey(account);
  const treasury = new PublicKey(payment.recipient);
  const mint = new PublicKey(payment.mint);
  const amountRaw = BigInt(payment.amountRaw);
  const [balance, lamports, treasuryAtaOwner, blockhash] = await Promise.all([
    deps.reader.tokenAmount(associatedTokenAddress(payer, mint, tokenProgram).toBase58()),
    deps.reader.lamports(account),
    deps.reader.accountOwner(associatedTokenAddress(treasury, mint, tokenProgram).toBase58()),
    deps.reader.latestBlockhash(),
  ]);
  if (balance < amountRaw) {
    return fail(
      "insufficient_usdc",
      `This wallet has ${usdc(balance)} USDC on ${where}. Pro costs ${usdc(amountRaw)} USDC.`,
    );
  }
  const createTreasuryAta = treasuryAtaOwner === null;
  const needLamports = BigInt(FEE_LAMPORTS + (createTreasuryAta ? TOKEN_ACCOUNT_RENT_LAMPORTS : 0));
  if (lamports < needLamports) {
    return fail(
      "insufficient_sol",
      `This wallet needs about ${(Number(needLamports) / 1e9).toFixed(4)} SOL on ${where} for the network fee.`,
    );
  }

  const tx = buildUsdcTransferTx({
    payer,
    treasury,
    mint,
    tokenProgram,
    amountRaw,
    reference: new PublicKey(payment.reference),
    blockhash,
    createTreasuryAta,
  });
  const transaction = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
  return { ok: true, transaction, network };
}

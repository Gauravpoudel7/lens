import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import type { LensConfig } from "../types.js";
import { MEMO_PROGRAM_ID, extractMemoFromLogs, memoFromInstructionData } from "./hash.js";

export interface ProofMemo {
  payload: string | null;
  cluster: string;
  slotTime: string | null;
  /** Pubkeys that signed the transaction. Empty when the memo is local mock data. */
  signers: string[];
}

export interface ProofPublisher {
  publish(payload: string): Promise<{ signature: string; cluster: string }>;
  readMemo(signature: string): Promise<ProofMemo>;
}

export function configuredProofSigner(
  config: Pick<LensConfig, "proofSigner" | "solanaKeypair" | "solanaKeypairPath">,
): string | null {
  if (config.proofSigner) return config.proofSigner;
  try {
    return loadKeypairFromConfig(config).publicKey.toBase58();
  } catch {
    return null;
  }
}

export function loadKeypair(raw: string): Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    const secret = JSON.parse(trimmed) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  if (trimmed.startsWith("{") && trimmed.includes("secretKey")) {
    const parsed = JSON.parse(trimmed) as { secretKey?: number[] };
    if (!parsed.secretKey) throw new Error("SOLANA_KEYPAIR JSON is missing secretKey");
    return Keypair.fromSecretKey(Uint8Array.from(parsed.secretKey));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

export function loadKeypairFromConfig(config: Pick<LensConfig, "solanaKeypair" | "solanaKeypairPath">): Keypair {
  if (config.solanaKeypair) return loadKeypair(config.solanaKeypair);
  if (config.solanaKeypairPath) return loadKeypair(readFileSync(config.solanaKeypairPath, "utf8"));
  throw new Error("SOLANA_KEYPAIR or SOLANA_KEYPAIR_PATH is required when PROOF_MODE=solana");
}

export function createSolanaProofPublisher(
  config: Pick<LensConfig, "solanaRpcUrl" | "solanaCluster" | "solanaKeypair" | "solanaKeypairPath">,
): ProofPublisher {
  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  return {
    async publish(payload) {
      const payer = loadKeypairFromConfig(config);
      const instruction = new TransactionInstruction({
        keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: Buffer.from(payload, "utf8"),
      });
      const transaction = new Transaction().add(instruction);
      const signature = await sendAndConfirmTransaction(connection, transaction, [payer], {
        commitment: "confirmed",
      });
      return { signature, cluster: config.solanaCluster };
    },
    async readMemo(signature) {
      let tx = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        tx = await connection.getTransaction(signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        if (tx) break;
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
      if (!tx) {
        return { payload: null, cluster: config.solanaCluster, slotTime: null, signers: [] };
      }
      const payload = extractMemoFromTransaction(tx);
      const slotTime = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null;
      return { payload, cluster: config.solanaCluster, slotTime, signers: extractSigners(tx) };
    },
  };
}

export function extractSigners(tx: {
  transaction: {
    message: {
      header?: { numRequiredSignatures?: number };
      staticAccountKeys?: Array<{ toBase58(): string } | string>;
      accountKeys?: Array<{ toBase58(): string } | string>;
    };
  };
}): string[] {
  const message = tx.transaction.message;
  const keys = message.staticAccountKeys ?? message.accountKeys ?? [];
  const count = message.header?.numRequiredSignatures ?? 0;
  if (count <= 0) return [];
  return keys.slice(0, count).map((key) => (typeof key === "string" ? key : key.toBase58()));
}

export function extractMemoFromTransaction(tx: {
  meta?: { logMessages?: string[] | null } | null;
  transaction: {
    message: {
      staticAccountKeys?: PublicKey[];
      accountKeys?: PublicKey[];
      compiledInstructions?: Array<{ programIdIndex: number; data: Uint8Array }>;
      instructions?: Array<{ programIdIndex: number; data: Uint8Array | Buffer | string }>;
    };
  };
}): string | null {
  const message = tx.transaction.message;
  const keys = message.staticAccountKeys ?? message.accountKeys ?? [];
  const compiled = message.compiledInstructions ?? message.instructions ?? [];
  for (const instruction of compiled) {
    const program = keys[instruction.programIdIndex];
    if (!program || program.toBase58() !== MEMO_PROGRAM_ID) continue;
    const data =
      typeof instruction.data === "string"
        ? bs58.decode(instruction.data)
        : instruction.data;
    const memo = memoFromInstructionData(data);
    if (memo) return memo;
  }
  return extractMemoFromLogs(tx.meta?.logMessages ?? []);
}

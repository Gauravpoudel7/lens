import { rpcCall } from "../net/rpc.js";
import type { CheckoutChainReader, SolanaNetwork } from "./checkout-tx.js";
import { parseParsedTransaction, type PaymentChain, type ReferencePayment } from "./solana-pay.js";

const GENESIS: Record<string, SolanaNetwork> = {
  "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d": "mainnet-beta",
  EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG: "devnet",
};

export function createRpcPaymentChain(rpcUrl: string, attempts = 4): PaymentChain {
  return {
    async findPayments(reference) {
      const listed = await rpc(rpcUrl, "getSignaturesForAddress", [reference, { limit: 20 }], attempts);
      const signatures = Array.isArray(listed)
        ? listed.filter((row) => row && typeof row === "object" && !(row as { err?: unknown }).err)
        : [];
      const found: ReferencePayment[] = [];
      for (const row of signatures.slice(0, 8)) {
        const signature = (row as { signature?: string }).signature;
        if (!signature) continue;
        const tx = await rpc(
          rpcUrl,
          "getTransaction",
          [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
          attempts,
        );
        const parsed = parseParsedTransaction(tx);
        if (!parsed) continue;
        found.push({ signature, ...parsed });
      }
      return found;
    },
  };
}

const readers = new Map<string, CheckoutChainReader>();

/** One reader per RPC URL, so the genesis lookup runs once per process instead of once per request. */
export function createRpcCheckoutReader(rpcUrl: string, attempts = 4): CheckoutChainReader {
  const key = `${attempts}|${rpcUrl}`;
  let reader = readers.get(key);
  if (!reader) {
    reader = newCheckoutReader(rpcUrl, attempts);
    readers.set(key, reader);
  }
  return reader;
}

function newCheckoutReader(rpcUrl: string, attempts: number): CheckoutChainReader {
  let network: Promise<SolanaNetwork> | null = null;
  return {
    network() {
      network ??= rpc(rpcUrl, "getGenesisHash", [], attempts).then(
        (hash) => GENESIS[String(hash)] ?? "unknown",
        (error: unknown) => {
          network = null;
          throw error;
        },
      );
      return network;
    },
    async accountOwner(address) {
      const result = (await rpc(rpcUrl, "getAccountInfo", [address, { encoding: "base64" }], attempts)) as {
        value?: { owner?: string } | null;
      } | null;
      return result?.value?.owner ?? null;
    },
    async lamports(address) {
      const result = (await rpc(rpcUrl, "getBalance", [address], attempts)) as { value?: number } | null;
      return BigInt(result?.value ?? 0);
    },
    async tokenAmount(address) {
      const owner = await this.accountOwner(address);
      if (!owner) return 0n;
      const result = (await rpc(rpcUrl, "getTokenAccountBalance", [address], attempts)) as {
        value?: { amount?: string };
      } | null;
      return BigInt(result?.value?.amount ?? "0");
    },
    async simulate(transactionBase64) {
      const result = (await rpc(
        rpcUrl,
        "simulateTransaction",
        [transactionBase64, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed" }],
        attempts,
      )) as { value?: { err?: unknown; logs?: string[] | null } } | null;
      const err = result?.value?.err;
      if (!err) return { error: null };
      const logs = (result?.value?.logs ?? []).slice(-4).join(" | ");
      return { error: `${JSON.stringify(err)}${logs ? ` ${logs}` : ""}` };
    },
    async latestBlockhash() {
      const result = (await rpc(rpcUrl, "getLatestBlockhash", [{ commitment: "confirmed" }], attempts)) as {
        value?: { blockhash?: string };
      } | null;
      if (!result?.value?.blockhash) throw new Error("RPC getLatestBlockhash returned no blockhash");
      return result.value.blockhash;
    },
  };
}

function rpc(rpcUrl: string, method: string, params: unknown[], attempts: number): Promise<unknown> {
  return rpcCall(rpcUrl, method, params, { attempts });
}

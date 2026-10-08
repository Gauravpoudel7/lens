import { withRetry } from "../net/retry.js";
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

export function createRpcCheckoutReader(rpcUrl: string, attempts = 4): CheckoutChainReader {
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
    async latestBlockhash() {
      const result = (await rpc(rpcUrl, "getLatestBlockhash", [{ commitment: "confirmed" }], attempts)) as {
        value?: { blockhash?: string };
      } | null;
      if (!result?.value?.blockhash) throw new Error("RPC getLatestBlockhash returned no blockhash");
      return result.value.blockhash;
    },
  };
}

async function rpc(rpcUrl: string, method: string, params: unknown[], attempts: number): Promise<unknown> {
  return withRetry(
    `pay ${method}`,
    async () => {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`RPC HTTP ${response.status} ${method}`);
      const json = (await response.json()) as { result?: unknown; error?: { message?: string; code?: number } };
      if (json.error) {
        const message = json.error.message ?? `RPC ${method} failed`;
        if (json.error.code === 429 || /429|too many requests/i.test(message)) {
          throw new Error(`RPC HTTP 429 ${method}: ${message}`);
        }
        throw new Error(message);
      }
      return json.result;
    },
    { attempts, baseMs: 500 },
  );
}

import { withRetry } from "../net/retry.js";
import { parseParsedTransaction, type PaymentChain, type ReferencePayment } from "./solana-pay.js";

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

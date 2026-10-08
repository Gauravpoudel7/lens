import { withRetry } from "./retry.js";

/**
 * One Solana JSON-RPC call with retry on 429, 5xx, and dropped connections. A JSON-RPC error with code 429 is
 * rewritten as `RPC HTTP 429` so `withRetry` and `isBusyError` treat it like the HTTP status.
 */
export async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[],
  opts: { attempts?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<unknown> {
  return withRetry(
    `rpc ${method}`,
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
    { attempts: opts.attempts, baseMs: 500, sleep: opts.sleep },
  );
}

/** True when an error means the RPC or an upstream API is rate-limiting or down, so "try again" is the advice. */
export function isBusyError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /HTTP 429|HTTP 50[234]|too many requests|timeout|ECONNRESET|ETIMEDOUT|fetch failed/i.test(message);
}

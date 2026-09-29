import { log } from "../ids.js";

export function isRetryable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /HTTP 429|RPC HTTP 429|HTTP 502|HTTP 503|HTTP 504|too many requests|timeout|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(
    message,
  );
}

export function retryDelayMs(attempt: number, baseMs: number): number {
  const exp = baseMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * Math.min(250, baseMs));
  return exp + jitter;
}

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts?: { attempts?: number; baseMs?: number; sleep?: (ms: number) => Promise<void> },
): Promise<T> {
  const attempts = Math.max(1, opts?.attempts ?? 4);
  const baseMs = opts?.baseMs ?? 400;
  const sleep = opts?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRetryable(err) || attempt === attempts - 1) throw err;
      const delayMs = retryDelayMs(attempt, baseMs);
      log("retrying request", {
        label,
        attempt: attempt + 1,
        delayMs,
        error: (err instanceof Error ? err.message : String(err)).slice(0, 180),
      });
      await sleep(delayMs);
    }
  }
  throw last;
}

import { createRuntime, type LensRuntime } from "@lens/db";

const globalForLens = globalThis as unknown as { lens?: Promise<LensRuntime> };

export function getRuntime(): Promise<LensRuntime> {
  if (!globalForLens.lens) {
    // Drop a failed start so the next request retries instead of failing forever.
    globalForLens.lens = createRuntime().catch((err: unknown) => {
      globalForLens.lens = undefined;
      throw err;
    });
  }
  return globalForLens.lens;
}

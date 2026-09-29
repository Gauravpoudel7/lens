import { createRuntime, type LensRuntime } from "@lens/db";

const globalForLens = globalThis as unknown as { lens?: Promise<LensRuntime> };

export function getRuntime(): Promise<LensRuntime> {
  if (!globalForLens.lens) globalForLens.lens = createRuntime();
  return globalForLens.lens;
}

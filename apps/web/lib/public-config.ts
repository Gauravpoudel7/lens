import { loadConfig, type LensConfig } from "@lens/core";
import { bootstrapEnv } from "@lens/db";
import { getRuntime } from "./runtime";

export async function publicConfig(): Promise<LensConfig> {
  try {
    const rt = await getRuntime();
    return rt.config;
  } catch {
    bootstrapEnv();
    return loadConfig();
  }
}

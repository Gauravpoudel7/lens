import { loadConfig, type LensConfig } from "@lens/core";
import { getRuntime } from "./runtime";

export async function publicConfig(): Promise<LensConfig> {
  try {
    const rt = await getRuntime();
    return rt.config;
  } catch {
    return loadConfig();
  }
}

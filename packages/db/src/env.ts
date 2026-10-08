import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { repoRoot as findRepoRoot } from "@lens/core";

export const repoRoot = findRepoRoot();

let loaded = false;

export function bootstrapEnv(): void {
  if (!loaded) {
    loadDotenv({ path: path.join(repoRoot, ".env") });
    loaded = true;
  }
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${path.join(repoRoot, "data", "lens.db")}`;
  }
  // Mode, URL, and cluster defaults live in loadConfig only.
}

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(here, "../../..");

let loaded = false;

export function bootstrapEnv(): void {
  if (!loaded) {
    loadDotenv({ path: path.join(repoRoot, ".env") });
    loaded = true;
  }
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${path.join(repoRoot, "data", "lens.db")}`;
  }
  process.env.DATA_MODE ??= "mock";
  process.env.PROOF_MODE ??= "mock";
  process.env.X_MODE ??= "mock";
  process.env.PUBLIC_BASE_URL ??= "http://127.0.0.1:3847";
  process.env.SOLANA_CLUSTER ??= "devnet";
}

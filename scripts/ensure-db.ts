import { execSync } from "node:child_process";
import { bootstrapEnv, repoRoot } from "@lens/db";

bootstrapEnv();
execSync("npx prisma db push --skip-generate", {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

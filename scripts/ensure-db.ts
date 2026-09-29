import { execSync } from "node:child_process";
import { bootstrapEnv, repoRoot } from "@lens/db";
import { schemaFile } from "./prepare-schema.mjs";

bootstrapEnv();
const schema = schemaFile();
const postgres = schema.endsWith("schema.postgres.prisma");
if (postgres) {
  execSync(`npx prisma generate --schema "${schema}"`, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
}
execSync(`npx prisma db push --schema "${schema}" --skip-generate`, {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

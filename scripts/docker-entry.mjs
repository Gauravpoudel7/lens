import { execSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { schemaFile } from "./prepare-schema.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

if (!process.env.DATABASE_URL) {
  mkdirSync(path.join(root, "data"), { recursive: true });
  process.env.DATABASE_URL = `file:${path.join(root, "data", "lens.db")}`;
}

const schema = schemaFile();
if (schema.endsWith("schema.postgres.prisma")) {
  execSync(`npx prisma generate --schema "${schema}"`, { stdio: "inherit", env: process.env });
}
execSync(`npx prisma db push --schema "${schema}" --skip-generate`, { stdio: "inherit", env: process.env });

const role = process.env.LENS_ROLE ?? "web";
if (role === "all") {
  const worker = spawn("npx", ["tsx", "apps/worker/src/index.ts"], {
    stdio: "inherit",
    env: process.env,
  });
  worker.on("exit", (code, signal) => {
    console.error(
      JSON.stringify({
        time: new Date().toISOString(),
        level: "error",
        service: "lens",
        msg: "worker stopped",
        code,
        signal,
      }),
    );
  });
}
if (role === "worker") {
  execSync("npx tsx apps/worker/src/index.ts", { stdio: "inherit", env: process.env });
} else {
  execSync("npm run start -w @lens/web", { stdio: "inherit", env: process.env });
}

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function schemaFile() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("postgres")) return path.join(root, "prisma/schema.prisma");
  const src = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  const pg = src.replace(
    /datasource db \{[\s\S]*?\}/,
    'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}',
  );
  const dir = path.join(root, "prisma/.generated");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "schema.postgres.prisma");
  writeFileSync(file, pg);
  return file;
}

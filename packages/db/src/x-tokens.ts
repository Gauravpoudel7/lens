import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  isOAuth2TokenRecord,
  logError,
  pickNewerToken,
  type OAuth2TokenStore,
} from "@lens/core";
import { getPrisma } from "./client.js";
import { repoRoot } from "./env.js";

const ROW_ID = "oauth2";

export function oauth2TokenFilePath(): string {
  return path.join(repoRoot, "data", "x-oauth2.json");
}

export function createFileOAuth2TokenStore(filePath: string): OAuth2TokenStore {
  return {
    async read() {
      try {
        const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
        return isOAuth2TokenRecord(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    async write(record) {
      const dir = path.dirname(filePath);
      mkdirSync(dir, { recursive: true });
      const tmp = `${filePath}.tmp`;
      writeFileSync(tmp, `${JSON.stringify(record)}\n`, { mode: 0o600 });
      renameSync(tmp, filePath);
      try {
        chmodSync(filePath, 0o600);
      } catch {
        // Some filesystems ignore mode bits. The file is still gitignored.
      }
    },
  };
}

export function createDbOAuth2TokenStore(): OAuth2TokenStore {
  return {
    async read() {
      const row = await getPrisma().xOAuth2Token.findUnique({ where: { id: ROW_ID } });
      if (!row) return null;
      return {
        accessToken: row.accessToken,
        refreshToken: row.refreshToken,
        expiresAt: row.expiresAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },
    async write(record) {
      const data = {
        accessToken: record.accessToken,
        refreshToken: record.refreshToken,
        expiresAt: new Date(record.expiresAt),
        updatedAt: new Date(record.updatedAt),
      };
      await getPrisma().xOAuth2Token.upsert({
        where: { id: ROW_ID },
        create: { id: ROW_ID, ...data },
        update: data,
      });
    },
  };
}

export function createPersistedOAuth2TokenStore(filePath = oauth2TokenFilePath()): OAuth2TokenStore {
  const file = createFileOAuth2TokenStore(filePath);
  const db = createDbOAuth2TokenStore();
  return {
    async read() {
      const [fromDb, fromFile] = await Promise.all([
        db.read().catch(() => null),
        file.read().catch(() => null),
      ]);
      return pickNewerToken(fromDb, fromFile);
    },
    async write(record) {
      const failures: string[] = [];
      try {
        await db.write(record);
      } catch (err) {
        failures.push("database");
        logError("oauth2 database save failed", err instanceof Error ? err.message : "database save failed");
      }
      try {
        await file.write(record);
      } catch (err) {
        failures.push("file");
        logError("oauth2 file save failed", err instanceof Error ? err.message : "file save failed");
      }
      if (failures.length === 2) {
        throw new Error(
          "X rotated the refresh token, but Lens could not save it. Run npm run x:oauth2-login again.",
        );
      }
    },
  };
}

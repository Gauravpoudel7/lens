import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OAuth2TokenRecord } from "@lens/core";
import { createFileOAuth2TokenStore } from "./x-tokens.js";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function record(refreshToken: string, updatedAt: string): OAuth2TokenRecord {
  return {
    accessToken: `access-${refreshToken}`,
    refreshToken,
    expiresAt: "2026-09-29T18:00:00.000Z",
    updatedAt,
  };
}

describe("OAuth 2.0 token file", () => {
  it("writes the rotated tokens to a gitignored json file and reads them back", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lens-oauth2-"));
    dirs.push(dir);
    const store = createFileOAuth2TokenStore(path.join(dir, "x-oauth2.json"));
    expect(await store.read()).toBeNull();
    await store.write(record("refresh-2", "2026-09-29T16:00:00.000Z"));
    expect((await store.read())?.refreshToken).toBe("refresh-2");
    const raw = readFileSync(path.join(dir, "x-oauth2.json"), "utf8");
    expect(raw).toContain("refresh-2");
    expect(raw).not.toContain("client_secret");
  });
});

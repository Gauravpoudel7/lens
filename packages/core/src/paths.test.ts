import path from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot, resolveFromRepoRoot } from "./paths.js";

const root = path.resolve(import.meta.dirname, "../../..");

describe("repo paths", () => {
  it("finds the workspace root from a nested folder", () => {
    expect(repoRoot(path.join(root, "apps", "web"))).toBe(root);
    expect(repoRoot(root)).toBe(root);
  });

  it("resolves relative env paths from the root, not the working directory", () => {
    expect(resolveFromRepoRoot("data/devnet-keypair.json", path.join(root, "apps", "web"))).toBe(
      path.join(root, "data", "devnet-keypair.json"),
    );
    expect(resolveFromRepoRoot("/tmp/key.json", path.join(root, "apps", "web"))).toBe("/tmp/key.json");
  });
});

describe("proof signer path", () => {
  it("loads a relative SOLANA_KEYPAIR_PATH when the process runs from apps/web", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { Keypair } = await import("@solana/web3.js");
    const { loadConfig } = await import("./config.js");
    const { configuredProofSigner } = await import("./proof/solana.js");
    const dir = mkdtempSync(path.join(root, "data", "keypath-"));
    const keypair = Keypair.generate();
    writeFileSync(path.join(dir, "k.json"), JSON.stringify(Array.from(keypair.secretKey)));
    const before = process.cwd();
    try {
      process.chdir(path.join(root, "apps", "web"));
      const config = loadConfig({ SOLANA_KEYPAIR_PATH: path.relative(root, path.join(dir, "k.json")) });
      expect(configuredProofSigner(config)).toBe(keypair.publicKey.toBase58());
    } finally {
      process.chdir(before);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

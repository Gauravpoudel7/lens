import { execSync } from "node:child_process";
import { FIXTURES, explorerTxUrl, processMention } from "@lens/core";
import { bootstrapEnv, createRuntime, repoRoot } from "@lens/db";
import { ensureDevnetKeypair } from "./devnet-keypair.js";
import { schemaFile } from "./prepare-schema.mjs";

bootstrapEnv();
process.env.DATA_MODE = "mock";
process.env.PROOF_MODE = "solana";
process.env.X_MODE = "mock";
process.env.LLM_MODE = "template";
process.env.SOLANA_CLUSTER = "devnet";
process.env.SOLANA_RPC_URL ??= "https://api.devnet.solana.com";

const funded = await ensureDevnetKeypair();
process.env.SOLANA_KEYPAIR_PATH = funded.file;

execSync(`npx prisma db push --schema "${schemaFile()}" --skip-generate`, {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

const rt = await createRuntime();
const stamp = Date.now().toString();
const result = await processMention(rt, {
  id: `devnet-mention-${stamp}`,
  authorId: "devnet-demo",
  authorUsername: "devnet_demo",
  text: `Check this. CA: ${FIXTURES.danger.mint} LP locked and burned`,
});

if (result.status !== "replied") {
  throw new Error(`Devnet demo did not reply: ${result.status}`);
}
const check = await rt.store.getCheck(result.checkId);
const signature = check?.proof?.txSignature;
if (!signature || signature.startsWith("mock_")) {
  throw new Error("Expected a real devnet memo signature.");
}
const explorer = explorerTxUrl(signature, "devnet");
console.log(
  JSON.stringify(
    {
      msg: "devnet memo confirmed",
      checkId: result.checkId,
      signature,
      explorer,
      hash: check?.proof?.contentHash,
      cluster: check?.proof?.cluster,
      pubkey: funded.pubkey,
    },
    null,
    2,
  ),
);

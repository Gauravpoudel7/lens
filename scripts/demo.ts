import { execSync } from "node:child_process";
import {
  FIXTURES,
  MockTokenDataProvider,
  MockXClient,
  computeStats,
  processMention,
  publishOutbound,
  scoreDueChecks,
} from "@lens/core";
import { bootstrapEnv, createRuntime, repoRoot } from "@lens/db";

bootstrapEnv();
process.env.DATA_MODE = "mock";
process.env.PROOF_MODE = "mock";
process.env.X_MODE = "mock";
process.env.LLM_MODE = "template";

execSync("npx prisma db push --skip-generate", {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});

const rt = await createRuntime();
if (!(rt.x instanceof MockXClient) || !(rt.provider instanceof MockTokenDataProvider)) {
  throw new Error("Demo expected mock X and mock market data.");
}

const mentionId = "demo-mention-danger";
const parentId = "demo-parent-danger";
rt.x.seed({
  id: parentId,
  authorId: "promoter",
  authorUsername: "mooncalls",
  text: `Just aped $DANGER. CA: ${FIXTURES.danger.mint} LP locked and burned. 100x soon`,
  parentId: null,
  createdAt: new Date().toISOString(),
});

const existing = await rt.store.getMention(mentionId);
let mentionCheckId = existing?.checkId ?? null;
if (!existing || existing.status === "processing" || existing.status === "error") {
  const result = await processMention(rt, {
    id: mentionId,
    authorId: "demo-user",
    authorUsername: "trader_joe",
    text: "@askLens is this legit?",
    parentId,
  });
  mentionCheckId = result.checkId;
  console.log(`\nMention: ${result.status}`);
  if (result.status === "replied") {
    console.log(result.replyText);
  }
} else {
  console.log(`\nMention already recorded (${existing.status}).`);
}

const checks = await rt.store.listChecks({ limit: 500 });
const safe = checks.find((check) => check.tokenMint === FIXTURES.safe.mint && check.kind === "call");
if (!safe) {
  const posted = await publishOutbound(rt, FIXTURES.safe.mint);
  if (!posted.ok) {
    console.error("Outbound call failed", posted.error, posted.detail ?? "");
  } else {
    console.log(`\nOutbound call: $${posted.check.tokenSymbol} ${posted.check.riskLevel}`);
    console.log(posted.check.replyText);
  }
} else {
  console.log("\nOutbound SAFE call already recorded.");
}

rt.provider.setPrice(FIXTURES.danger.mint, FIXTURES.danger.priceAfterWindow);
rt.provider.setPrice(FIXTURES.safe.mint, FIXTURES.safe.priceAfterWindow);
const scored = await scoreDueChecks(rt, { windowDays: 0 });
console.log(`\nScored ${scored} check${scored === 1 ? "" : "s"}.`);

const latest = await rt.store.listChecks({ limit: 20 });
const stats = computeStats(latest, {
  windowDays: 0,
  sharpDropPct: rt.config.sharpDropPct,
  callWinPct: rt.config.callWinPct,
});
const danger = latest.find((check) => check.id === mentionCheckId) ?? latest.find((check) => check.tokenMint === FIXTURES.danger.mint);

console.log("\nScorecard");
console.log(`  checks: ${stats.totalChecks}`);
console.log(`  call win rate: ${stats.callWinRate == null ? "n/a" : `${Math.round(stats.callWinRate * 100)}%`}`);
console.log(
  `  high-risk drop rate: ${stats.highRiskDropRate == null ? "n/a" : `${Math.round(stats.highRiskDropRate * 100)}%`}`,
);
if (danger?.proof) {
  console.log("\nDanger reply proof");
  console.log(`  risk: ${danger.riskLevel}`);
  console.log(`  hash: ${danger.proof.contentHash}`);
  console.log(`  signature: ${danger.proof.txSignature}`);
  console.log(`  cluster: ${danger.proof.cluster}`);
  console.log(`  report: ${rt.config.publicBaseUrl}/r/${danger.id}`);
}
console.log(`\nOpen the scorecard at ${rt.config.publicBaseUrl}`);
console.log("Start it with: npm run dev");

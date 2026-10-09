/**
 * Lists live checks made before the 2026-10-09 data fixes whose numbers cannot be backed up.
 * Dry run by default. `npm run checks:review -- --apply` hides them from the public scorecard.
 * Hidden checks keep their proof and report link. Nothing is deleted.
 * Reads mainnet (Jupiter, DexScreener, RugCheck, RPC). Does not post or write memos.
 */
import {
  LiveTokenDataProvider,
  loadConfig,
  needsReview,
  reviewReasons,
  rpcCall,
  shortMint,
  type ReviewContext,
} from "@lens/core";
import { bootstrapEnv, createPrismaStore } from "@lens/db";

bootstrapEnv();
const apply = process.argv.includes("--apply");
const config = loadConfig();
const store = createPrismaStore();
const provider = new LiveTokenDataProvider(config);

const checks = (await store.listChecks({ limit: 10_000 })).filter(needsReview);
const contexts = new Map<string, ReviewContext>();

async function contextFor(mint: string, symbol: string): Promise<ReviewContext> {
  const key = `${mint}:${symbol}`;
  const known = contexts.get(key);
  if (known) return known;
  const match = await provider.resolveBySymbol(symbol);
  if (match.status === "unavailable") throw new Error("Jupiter verified list is unavailable. Nothing was changed.");
  const supply = (await rpcCall(config.dataRpcUrl, "getTokenSupply", [mint]).catch(() => null)) as {
    value?: { uiAmount?: number | null };
  } | null;
  const ctx: ReviewContext = {
    mintVerified: await provider.isVerifiedMint(mint),
    symbolHasVerified: match.status === "unique" || match.status === "ambiguous",
    supplyUi: supply?.value?.uiAmount ?? null,
    current: await provider.getToken(mint),
  };
  contexts.set(key, ctx);
  return ctx;
}

const flagged: Array<{ id: string; reasons: string[] }> = [];
for (const check of checks) {
  const reasons = reviewReasons(check, await contextFor(check.tokenMint, check.tokenSymbol));
  if (reasons.length === 0) continue;
  flagged.push({ id: check.id, reasons });
  console.log(
    [check.id, check.createdAt.slice(0, 16), check.kind, `$${check.tokenSymbol}`, shortMint(check.tokenMint), check.riskLevel, reasons.join("; ")].join(" | "),
  );
}

console.log(`\n${checks.length} older live checks reviewed, ${flagged.length} flagged.`);
if (!apply) {
  console.log("Dry run. Nothing changed. Add --apply to hide the flagged checks from the scorecard.");
} else {
  for (const row of flagged) {
    await store.updateCheck(row.id, { status: "hidden", error: `Hidden by data review: ${row.reasons.join("; ")}` });
  }
  console.log(`Hid ${flagged.length} check${flagged.length === 1 ? "" : "s"}. Proofs and report links are unchanged.`);
}

/**
 * Prints the next tip, the next term, today's activity recap, and a live market recap,
 * each with its X weighted length or the reason it would be skipped.
 * Reads the local database and mainnet APIs. No proof, no post, no writes.
 */
import {
  buildActivityRecap,
  buildMarketRecap,
  composeTerm,
  composeTip,
  listTrendingSolana,
  loadConfig,
  loadMarketRows,
  LiveTokenDataProvider,
  rotationIndex,
  utcDay,
  xWeightedLength,
} from "@lens/core";
import { bootstrapEnv, createPrismaStore } from "@lens/db";

bootstrapEnv();
const config = loadConfig();
const store = createPrismaStore();
const now = new Date();

function show(title: string, text: string | null, reason?: string) {
  console.log(`\n=== ${title}`);
  if (!text) {
    console.log(`(skipped: ${reason})`);
    return;
  }
  console.log(text);
  console.log(`--- ${xWeightedLength(text)}/280 weighted characters`);
}

const tipIndex = await rotationIndex({ store }, "tip");
const termIndex = await rotationIndex({ store }, "term");
show(`Next tip (#${tipIndex + 1})`, composeTip(tipIndex));
show(`Next term (#${termIndex + 1})`, composeTerm(termIndex));

const checks = await store.listChecksBetween(`${utcDay(now)}T00:00:00.000Z`, now.toISOString());
show(
  `Activity recap for ${utcDay(now)} (${checks.length} checks today before filters)`,
  buildActivityRecap(checks, config.solanaCluster),
  "fewer than 3 live, public, current-rules coins checked today",
);

const coins = await listTrendingSolana();
if (coins.length === 0) {
  show("Market recap (live GeckoTerminal)", null, "trending pools could not be read");
} else {
  const rows = await loadMarketRows(new LiveTokenDataProvider(config), coins);
  console.log(
    `\nTrending candidates: ${coins.map((coin) => coin.symbol ?? coin.mint.slice(0, 4)).join(", ")}. Read the first ${rows.length}; ${rows.filter((row) => row?.liquidityUsd != null).length} passed the data checks.`,
  );
  show("Market recap (live GeckoTerminal)", buildMarketRecap(rows, now), "fewer than 3 trending coins passed the data checks");
}
console.log(`\nEDITORIAL_ENABLED=${config.editorialEnabled}. Nothing was proved or posted.`);

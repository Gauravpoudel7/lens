import { log, logError, pollOnce } from "@lens/core";
import { bootstrapEnv, createRuntime } from "@lens/db";
import { createLiveXClient } from "./x-live.js";

bootstrapEnv();

const live = process.env.X_MODE === "live";
const runtime = await createRuntime();
if (live) {
  runtime.x = await createLiveXClient(runtime.store);
}
const once = process.argv.includes("--once");

async function tick(): Promise<void> {
  const result = await pollOnce(runtime);
  log("poll finished", {
    seen: result.seen,
    replied: result.replied,
    scored: result.scored,
    dataMode: runtime.config.dataMode,
    proofMode: runtime.config.proofMode,
    xMode: live ? "live" : "mock",
  });
}

if (once) {
  await tick();
  process.exit(0);
}

await tick();
setInterval(() => {
  tick().catch((err) => {
    logError("poll failed", err instanceof Error ? err.message : err);
  });
}, runtime.config.pollIntervalMs);

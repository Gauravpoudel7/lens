import { log, logError, pollOnce, runPollLoop } from "@lens/core";
import { bootstrapEnv, createRuntime } from "@lens/db";
import { createLiveXClient } from "./x-live.js";

bootstrapEnv();

const runtime = await createRuntime();
if (runtime.config.xMode === "live") {
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
    xMode: runtime.config.xMode,
  });
}

if (once) {
  try {
    await tick();
    process.exit(0);
  } catch (err) {
    logError("poll failed", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

await runPollLoop(runtime, runtime.config.pollIntervalMs, {
  poll: async () => {
    await tick();
  },
});

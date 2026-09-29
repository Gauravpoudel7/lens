import { pollOnce } from "@lens/core";
import { bootstrapEnv, createRuntime } from "@lens/db";
import { createLiveXClient } from "./x-live.js";

bootstrapEnv();

const live = process.env.X_MODE === "live";
const runtime = await createRuntime(live ? { x: createLiveXClient() } : undefined);
const once = process.argv.includes("--once");

async function tick(): Promise<void> {
  const result = await pollOnce(runtime);
  console.log(
    `[lens] poll seen=${result.seen} replied=${result.replied} scored=${result.scored} data=${runtime.config.dataMode} proof=${runtime.config.proofMode} x=${live ? "live" : "mock"}`,
  );
}

if (once) {
  await tick();
  process.exit(0);
}

await tick();
setInterval(() => {
  tick().catch((err) => {
    console.error("[lens] poll failed", err instanceof Error ? err.message : err);
  });
}, runtime.config.pollIntervalMs);

import { log, runOutboundCycle } from "@lens/core";
import { bootstrapEnv, createRuntime } from "@lens/db";

bootstrapEnv();
const rt = await createRuntime();
if (!rt.config.outboundEnabled) {
  log("discovery skipped", { reason: "Set OUTBOUND_ENABLED=true to queue calls and warnings." });
  process.exit(0);
}
const result = await runOutboundCycle(rt);
log("discovery finished", result);

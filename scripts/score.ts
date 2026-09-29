import { scoreDueChecks } from "@lens/core";
import { bootstrapEnv, createRuntime } from "@lens/db";

bootstrapEnv();
const rt = await createRuntime();
const windowFlag = process.argv.indexOf("--window-days");
const windowDays =
  windowFlag >= 0 && process.argv[windowFlag + 1]
    ? Number(process.argv[windowFlag + 1])
    : undefined;
const scored = await scoreDueChecks(rt, {
  windowDays: windowDays != null && Number.isFinite(windowDays) ? windowDays : undefined,
});
console.log(`Scored ${scored} check${scored === 1 ? "" : "s"}.`);

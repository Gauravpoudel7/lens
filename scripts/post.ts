import { publishOutbound } from "@lens/core";
import { bootstrapEnv, createRuntime } from "@lens/db";

bootstrapEnv();
const flag = process.argv.indexOf("--mint");
const mint = flag >= 0 ? process.argv[flag + 1] : "";
if (!mint) {
  console.error("Usage: npm run post -- --mint <solana-address>");
  process.exit(1);
}

const rt = await createRuntime();
const result = await publishOutbound(rt, mint);
if (!result.ok) {
  console.error(result.error, result.detail ?? "");
  process.exit(1);
}
console.log(`${result.check.kind} $${result.check.tokenSymbol} ${result.check.riskLevel}`);
console.log(result.check.replyText);
console.log(`${rt.config.publicBaseUrl}/r/${result.check.id}`);
if (result.check.proof?.txSignature) {
  console.log(`proof ${result.check.proof.cluster} ${result.check.proof.txSignature}`);
}

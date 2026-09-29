import { existsSync } from "node:fs";
import {
  buildDoctorReport,
  formatDoctorReport,
  loadConfig,
  probeJupiter,
  probeRpc,
  probeXUser,
  type DoctorProbe,
} from "@lens/core";
import { bootstrapEnv } from "@lens/db";

bootstrapEnv();

const checkX = process.argv.includes("--x");
const config = loadConfig();

const rpc = config.heliusApiKey
  ? await probeRpc(config.dataRpcUrl, fetch, [config.heliusApiKey])
  : null;
const jupiter = await probeJupiter(config.jupiterBaseUrl, config.jupiterApiKey);

let xToken: DoctorProbe | "skipped" = "skipped";
if (checkX) {
  xToken = config.xAuthMode === "oauth1" ? await probeOAuth1() : await probeXUser(config.xOauth2AccessToken);
}

const keypairPresent = Boolean(config.solanaKeypair) || Boolean(config.solanaKeypairPath && existsSync(config.solanaKeypairPath));
const report = buildDoctorReport(config, { rpc, jupiter, xToken, keypairPresent });
console.log(formatDoctorReport(report));
process.exit(report.ready ? 0 : 1);

async function probeOAuth1(): Promise<DoctorProbe> {
  if (!config.xApiKey || !config.xApiSecret || !config.xAccessToken || !config.xAccessSecret) {
    return { ok: false, detail: "OAuth 1.0a keys are incomplete" };
  }
  try {
    const { TwitterApi } = await import("twitter-api-v2");
    const client = new TwitterApi({
      appKey: config.xApiKey,
      appSecret: config.xApiSecret,
      accessToken: config.xAccessToken,
      accessSecret: config.xAccessSecret,
    });
    const me = await client.v2.me();
    return { ok: true, detail: `users/me ${me.data.id}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "users/me failed";
    return { ok: false, detail: message.slice(0, 160) };
  }
}

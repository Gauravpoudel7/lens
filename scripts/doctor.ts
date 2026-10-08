import { existsSync } from "node:fs";
import {
  buildDoctorReport,
  createRpcCheckoutReader,
  loadKeypairFromConfig,
  rpcCall,
  formatDoctorReport,
  loadConfig,
  probeJupiter,
  probeRpc,
  probeXUser,
  type DoctorProbe,
} from "@lens/core";
import { bootstrapEnv, createPersistedOAuth2TokenStore } from "@lens/db";

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
const signer = await probeSigner();
const { proNetwork, usdcMintFound } = await probePro();
const storedRefreshToken = config.xAuthMode === "oauth2" ? await hasStoredRefreshToken() : false;
const report = buildDoctorReport(config, { rpc, jupiter, xToken, keypairPresent, signer, proNetwork, usdcMintFound, storedRefreshToken });
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

async function probeSigner(): Promise<{ pubkey: string; lamports: bigint | null } | null | undefined> {
  if (!config.solanaKeypair && !config.solanaKeypairPath) return undefined;
  let pubkey: string;
  try {
    pubkey = loadKeypairFromConfig(config).publicKey.toBase58();
  } catch {
    return null;
  }
  try {
    const balance = (await rpcCall(config.solanaRpcUrl, "getBalance", [pubkey], { attempts: 2 })) as { value?: number };
    return { pubkey, lamports: BigInt(balance?.value ?? 0) };
  } catch {
    return { pubkey, lamports: null };
  }
}

async function probePro(): Promise<{ proNetwork?: "mainnet-beta" | "devnet" | "unknown" | null; usdcMintFound?: boolean | null }> {
  if (!config.proTreasury) return {};
  const reader = createRpcCheckoutReader(config.proRpcUrl, 2);
  try {
    const proNetwork = await reader.network();
    const owner = await reader.accountOwner(config.usdcMint);
    return { proNetwork, usdcMintFound: owner !== null };
  } catch {
    return { proNetwork: null, usdcMintFound: null };
  }
}

async function hasStoredRefreshToken(): Promise<boolean> {
  try {
    return Boolean((await createPersistedOAuth2TokenStore().read())?.refreshToken);
  } catch {
    return false;
  }
}

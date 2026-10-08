import type { LensConfig } from "./types.js";
import { jupiterApiKeyHeader, WSOL_MINT } from "./providers/jupiter.js";

/** `note` is information about an optional feature. It never blocks "Ready." */
export type DoctorStatus = "ready" | "not-ready" | "note";

export interface DoctorRow {
  status: DoctorStatus;
  label: string;
}

export interface DoctorProbe {
  ok: boolean;
  detail: string;
}

export interface DoctorProbes {
  /** Null when HELIUS_API_KEY is missing and the RPC was not called. */
  rpc: DoctorProbe | null;
  jupiter: DoctorProbe;
  /** "skipped" when the caller did not pass --x. */
  xToken: DoctorProbe | "skipped";
  keypairPresent: boolean;
  /** True when a refreshed OAuth 2.0 token is already saved in the database or data/x-oauth2.json. */
  storedRefreshToken?: boolean;
  /** Genesis of PRO_RPC_URL. Undefined when not probed. */
  proNetwork?: "mainnet-beta" | "devnet" | "unknown" | null;
  /** Whether USDC_MINT is a token account on the Pro network. Undefined when not probed. */
  usdcMintFound?: boolean | null;
  /** The proof keypair's public key and SOL balance on SOLANA_RPC_URL. Null when it could not be read. */
  signer?: { pubkey: string; lamports: bigint | null } | null;
}

export interface DoctorReport {
  ready: boolean;
  rows: DoctorRow[];
}

const POLL_FLOOR_MS = 180_000;

export function buildDoctorReport(config: LensConfig, probes: DoctorProbes): DoctorReport {
  const rows: DoctorRow[] = [];

  if (!config.heliusApiKey) {
    rows.push({ status: "not-ready", label: "HELIUS_API_KEY is not set" });
  } else if (!probes.rpc) {
    rows.push({ status: "not-ready", label: "Helius was not checked" });
  } else if (probes.rpc.ok) {
    rows.push({ status: "ready", label: "Helius RPC answered" });
  } else {
    rows.push({ status: "not-ready", label: `Helius RPC failed: ${probes.rpc.detail}` });
  }

  rows.push(
    probes.jupiter.ok
      ? { status: "ready", label: `Jupiter answered at ${config.jupiterBaseUrl}` }
      : { status: "not-ready", label: `Jupiter failed: ${probes.jupiter.detail}` },
  );

  const missingX = missingXEnv(config, probes.storedRefreshToken ?? false);
  if (missingX.length > 0) {
    rows.push({ status: "not-ready", label: `Missing ${missingX.join(", ")}` });
  } else {
    rows.push({
      status: "ready",
      label: config.xAuthMode === "oauth2" ? "OAuth 2.0 X credentials are set" : "OAuth 1.0a X credentials are set",
    });
  }

  if (probes.xToken === "skipped") {
    rows.push({
      status: "ready",
      label: "X token was not called. Run npm run doctor -- --x for one users/me read",
    });
  } else if (probes.xToken.ok) {
    rows.push({ status: "ready", label: `X token is valid (${probes.xToken.detail})` });
  } else {
    rows.push({ status: "not-ready", label: `X token check failed: ${probes.xToken.detail}` });
  }

  rows.push(
    config.xReplyLinks
      ? { status: "not-ready", label: "X_REPLY_LINKS=true, so posts include URLs" }
      : {
          status: "ready",
          label: config.xSwapLinksOnRequest
            ? "X_REPLY_LINKS=false. A swap link is added only when a mention asks to buy, swap, or trade"
            : "X_REPLY_LINKS=false, replies are link-free",
        },
  );

  rows.push(
    config.xBotUserId
      ? { status: "ready", label: `X_BOT_USER_ID is set (${config.xBotUserId})` }
      : { status: "not-ready", label: "X_BOT_USER_ID is not set" },
  );

  rows.push(
    config.pollIntervalMs >= POLL_FLOOR_MS
      ? { status: "ready", label: `Poll interval is ${config.pollIntervalMs} ms` }
      : {
          status: "not-ready",
          label: `Poll interval is ${config.pollIntervalMs} ms, under the ${POLL_FLOOR_MS} ms default`,
        },
  );

  rows.push({
    status: "ready",
    label: `MAX_X_REPLIES_PER_DAY is ${config.maxXRepliesPerDay}`,
  });

  rows.push(
    probes.keypairPresent
      ? { status: "ready", label: "Proof keypair is set" }
      : { status: "not-ready", label: "SOLANA_KEYPAIR or SOLANA_KEYPAIR_PATH is not set" },
  );

  rows.push(...settingRows(config, probes));

  return { ready: rows.every((row) => row.status !== "not-ready"), rows };
}

const MIN_SIGNER_LAMPORTS = 10_000_000n;

/** Settings outside X: modes, proofs, Pro payments, sessions, links, and optional keys. Each line names the fix. */
function settingRows(config: LensConfig, probes: DoctorProbes): DoctorRow[] {
  const rows: DoctorRow[] = [];
  const note = (label: string) => rows.push({ status: "note", label });
  const ok = (label: string) => rows.push({ status: "ready", label });
  const fix = (label: string) => rows.push({ status: "not-ready", label });

  if (config.dataMode === "mock") fix("DATA_MODE=mock: token numbers are samples. Set DATA_MODE=live");
  else ok("DATA_MODE=live");
  if (config.proofMode === "mock") fix("PROOF_MODE=mock: answers are not stamped on Solana. Set PROOF_MODE=solana");
  else ok(`PROOF_MODE=solana on ${config.solanaCluster}`);

  if (config.proofMode === "solana" || config.solanaKeypair || config.solanaKeypairPath) {
    if (probes.signer === null) {
      fix(`The proof keypair could not be read. Check SOLANA_KEYPAIR or SOLANA_KEYPAIR_PATH (${config.solanaKeypairPath ?? "inline"})`);
    } else if (probes.signer) {
      const { pubkey, lamports } = probes.signer;
      if (lamports != null && lamports < MIN_SIGNER_LAMPORTS) {
        fix(`Proof wallet ${pubkey} has ${Number(lamports) / 1e9} SOL on ${config.solanaCluster}. Send it at least 0.01 SOL`);
      } else {
        ok(`Proof wallet ${pubkey}${lamports != null ? ` has ${(Number(lamports) / 1e9).toFixed(3)} SOL` : ""}`);
      }
      if (config.proofSigner && config.proofSigner !== pubkey) {
        fix(`PROOF_SIGNER (${config.proofSigner}) is not the proof keypair (${pubkey}). Proofs will not verify`);
      }
    }
  }

  if (!config.sessionSecret) fix("LENS_SESSION_SECRET is not set. Sign-ins end on restart. Set it to: openssl rand -hex 32");
  else ok("LENS_SESSION_SECRET is set");

  if (!/^https:\/\//.test(config.publicBaseUrl) || /localhost|127\.0\.0\.1/.test(config.publicBaseUrl)) {
    note(`PUBLIC_BASE_URL is ${config.publicBaseUrl}. Report and swap links stay off until it is a public https URL`);
  } else {
    ok(`PUBLIC_BASE_URL is ${config.publicBaseUrl}`);
  }

  if (!config.proTreasury) {
    note("PRO_TREASURY_WALLET is not set, so Pro payments are closed");
  } else {
    if (probes.proNetwork === "unknown" || probes.proNetwork === null) {
      fix("PRO_RPC_URL did not answer as mainnet or devnet. Check the URL");
    } else if (probes.proNetwork) {
      ok(`Pro payments run on ${probes.proNetwork} (PRO_RPC_URL)`);
    }
    if (probes.usdcMintFound === false) {
      fix(
        `USDC_MINT ${config.usdcMint} is not a token on ${probes.proNetwork ?? "the Pro network"}. ` +
          "Leave it empty for mainnet USDC, or use 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU on devnet",
      );
    }
  }

  if (!config.llmApiKey) note("LLM_API_KEY is not set, so replies use the fixed template");
  if (!config.birdeyeApiKey) note("BIRDEYE_API_KEY is not set, so creator-sold % is often unknown");
  if (!config.jupiterFeeAccount) note("JUPITER_FEE_ACCOUNT is not set, so swaps carry no fee");
  return rows;
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = report.rows.map((row) => `${row.status.padEnd(9)} ${row.label}`);
  lines.push("");
  lines.push(report.ready ? "Ready." : "Not ready. Fix the not-ready lines before you set X_MODE=live.");
  return lines.join("\n");
}

function missingXEnv(config: LensConfig, storedRefreshToken: boolean): string[] {
  if (config.xAuthMode === "oauth2") {
    const missing: string[] = [];
    if (!config.xOauth2ClientId) missing.push("X_OAUTH2_CLIENT_ID");
    if (!config.xOauth2ClientSecret) missing.push("X_OAUTH2_CLIENT_SECRET");
    if (!config.xOauth2RefreshToken && !storedRefreshToken) missing.push("X_OAUTH2_REFRESH_TOKEN");
    return missing;
  }
  const missing: string[] = [];
  if (!config.xApiKey) missing.push("X_API_KEY");
  if (!config.xApiSecret) missing.push("X_API_SECRET");
  if (!config.xAccessToken) missing.push("X_ACCESS_TOKEN");
  if (!config.xAccessSecret) missing.push("X_ACCESS_SECRET");
  return missing;
}

export function redactSecrets(text: string, secrets: Array<string | undefined>): string {
  let out = text;
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out.replace(/api-key=[^&\s]+/gi, "api-key=[redacted]");
}

export async function probeRpc(
  url: string,
  fetchImpl: typeof fetch = fetch,
  secrets: Array<string | undefined> = [],
): Promise<DoctorProbe> {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
    const json = (await response.json()) as { error?: { message?: string } };
    if (json.error) {
      return { ok: false, detail: redactSecrets(json.error.message ?? "rpc error", secrets).slice(0, 160) };
    }
    return { ok: true, detail: "answered" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "request failed";
    return { ok: false, detail: redactSecrets(message, secrets).slice(0, 160) };
  }
}

export async function probeJupiter(
  baseUrl: string,
  apiKey?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DoctorProbe> {
  try {
    const response = await fetchImpl(`${baseUrl}/price/v3?ids=${WSOL_MINT}`, {
      headers: jupiterApiKeyHeader(apiKey),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
    return { ok: true, detail: "answered" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "request failed";
    return { ok: false, detail: redactSecrets(message, [apiKey]).slice(0, 160) };
  }
}

/** One read of GET /2/users/me. Does not refresh or post. */
export async function probeXUser(
  accessToken: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<DoctorProbe> {
  if (!accessToken) {
    return {
      ok: false,
      detail: "X_OAUTH2_ACCESS_TOKEN is missing. Doctor does not refresh tokens.",
    };
  }
  try {
    const response = await fetchImpl("https://api.x.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` };
    const json = (await response.json()) as { data?: { id?: string } };
    const id = json.data?.id;
    return { ok: true, detail: id ? `users/me ${id}` : "users/me ok" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "request failed";
    return { ok: false, detail: redactSecrets(message, [accessToken]).slice(0, 160) };
  }
}

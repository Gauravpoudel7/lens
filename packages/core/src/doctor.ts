import type { LensConfig } from "./types.js";
import { jupiterApiKeyHeader, WSOL_MINT } from "./providers/jupiter.js";

export type DoctorStatus = "ready" | "not-ready";

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

  const missingX = missingXEnv(config);
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
      : { status: "ready", label: "X_REPLY_LINKS=false, replies are link-free" },
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

  return { ready: rows.every((row) => row.status === "ready"), rows };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = report.rows.map((row) => `${row.status.padEnd(9)} ${row.label}`);
  lines.push("");
  lines.push(report.ready ? "Ready." : "Not ready. Fix the not-ready lines before you set X_MODE=live.");
  return lines.join("\n");
}

function missingXEnv(config: LensConfig): string[] {
  if (config.xAuthMode === "oauth2") {
    const missing: string[] = [];
    if (!config.xOauth2ClientId) missing.push("X_OAUTH2_CLIENT_ID");
    if (!config.xOauth2ClientSecret) missing.push("X_OAUTH2_CLIENT_SECRET");
    if (!config.xOauth2RefreshToken) missing.push("X_OAUTH2_REFRESH_TOKEN");
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

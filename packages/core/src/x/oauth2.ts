import { createHash, randomBytes } from "node:crypto";

export const X_OAUTH2_AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
export const X_OAUTH2_TOKEN_URL = "https://api.x.com/2/oauth2/token";

export const X_OAUTH2_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "dm.read",
  "dm.write",
  "offline.access",
] as const;

const DEFAULT_EXPIRES_IN_SEC = 2 * 60 * 60;
const DEFAULT_SKEW_MS = 60_000;

export interface OAuth2TokenRecord {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  updatedAt: string;
}

export interface OAuth2TokenStore {
  read(): Promise<OAuth2TokenRecord | null>;
  write(record: OAuth2TokenRecord): Promise<void>;
}

export class MemoryOAuth2TokenStore implements OAuth2TokenStore {
  record: OAuth2TokenRecord | null = null;

  async read(): Promise<OAuth2TokenRecord | null> {
    return this.record ? { ...this.record } : null;
  }

  async write(record: OAuth2TokenRecord): Promise<void> {
    this.record = { ...record };
  }
}

export function isOAuth2TokenRecord(value: unknown): value is OAuth2TokenRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.accessToken === "string" &&
    row.accessToken.length > 0 &&
    typeof row.refreshToken === "string" &&
    row.refreshToken.length > 0 &&
    typeof row.expiresAt === "string" &&
    typeof row.updatedAt === "string" &&
    Number.isFinite(Date.parse(row.expiresAt)) &&
    Number.isFinite(Date.parse(row.updatedAt))
  );
}

export function pickNewerToken(
  left: OAuth2TokenRecord | null,
  right: OAuth2TokenRecord | null,
): OAuth2TokenRecord | null {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(left.updatedAt) >= Date.parse(right.updatedAt) ? left : right;
}

export function createPkcePair(): { verifier: string; challenge: string; state: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

export function buildAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: readonly string[];
}): string {
  const url = new URL(X_OAUTH2_AUTHORIZE_URL);
  const scopes = (input.scopes ?? X_OAUTH2_SCOPES).join(" ");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  const query = url.searchParams.toString().split("&");
  query.push(`scope=${encodeURIComponent(scopes)}`);
  return `${url.origin}${url.pathname}?${query.join("&")}`;
}

export function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export interface OAuth2TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}

export async function requestOAuth2Token(input: {
  clientId: string;
  clientSecret: string;
  body: URLSearchParams;
  fetchImpl?: typeof fetch;
  tokenUrl?: string;
}): Promise<OAuth2TokenResponse> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(input.tokenUrl ?? X_OAUTH2_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(input.clientId, input.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: input.body.toString(),
  });
  const text = await response.text();
  let json: {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    error?: unknown;
    error_description?: unknown;
  } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    json = {};
  }
  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  if (!response.ok || !accessToken) {
    const reason =
      (typeof json.error_description === "string" && json.error_description) ||
      (typeof json.error === "string" && json.error) ||
      `HTTP ${response.status}`;
    throw new Error(`X OAuth 2.0 token request failed: ${redactSecrets(reason, input.body)}`);
  }
  const refreshToken = typeof json.refresh_token === "string" && json.refresh_token ? json.refresh_token : null;
  const expiresIn =
    typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : DEFAULT_EXPIRES_IN_SEC;
  return { accessToken, refreshToken, expiresIn };
}

function redactSecrets(reason: string, body: URLSearchParams): string {
  let out = reason;
  for (const key of ["refresh_token", "code", "code_verifier"]) {
    const secret = body.get(key);
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out;
}

export class OAuth2TokenManager {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly options: {
      clientId: string;
      clientSecret: string;
      envRefreshToken?: string;
      store: OAuth2TokenStore;
      fetchImpl?: typeof fetch;
      now?: () => Date;
      skewMs?: number;
      tokenUrl?: string;
    },
  ) {}

  async getAccessToken(force = false): Promise<string> {
    const run = this.chain.then(() => this.resolve(force));
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async resolve(force: boolean): Promise<string> {
    const now = this.options.now?.() ?? new Date();
    const stored = await this.options.store.read();
    const skew = this.options.skewMs ?? DEFAULT_SKEW_MS;
    if (!force && stored && Date.parse(stored.expiresAt) - now.getTime() > skew) {
      return stored.accessToken;
    }
    if (!this.options.clientId || !this.options.clientSecret) {
      throw new Error("X OAuth 2.0 needs X_OAUTH2_CLIENT_ID and X_OAUTH2_CLIENT_SECRET.");
    }
    const refreshToken = stored?.refreshToken || this.options.envRefreshToken;
    if (!refreshToken) {
      throw new Error(
        "X OAuth 2.0 needs a refresh token. Set X_OAUTH2_REFRESH_TOKEN or run npm run x:oauth2-login.",
      );
    }
    let usedRefreshToken = refreshToken;
    const minted = await this.refresh(refreshToken).catch(async (err: unknown) => {
      const fallback = this.options.envRefreshToken;
      if (!stored || !fallback || fallback === refreshToken) throw err;
      usedRefreshToken = fallback;
      return this.refresh(fallback);
    });
    const record: OAuth2TokenRecord = {
      accessToken: minted.accessToken,
      refreshToken: minted.refreshToken ?? usedRefreshToken,
      expiresAt: new Date(now.getTime() + minted.expiresIn * 1000).toISOString(),
      updatedAt: now.toISOString(),
    };
    await this.options.store.write(record);
    return record.accessToken;
  }

  private refresh(refreshToken: string): Promise<OAuth2TokenResponse> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.options.clientId,
    });
    return requestOAuth2Token({
      clientId: this.options.clientId,
      clientSecret: this.options.clientSecret,
      body,
      fetchImpl: this.options.fetchImpl,
      tokenUrl: this.options.tokenUrl,
    });
  }
}

export function authorizationCodeBody(input: {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): URLSearchParams {
  return new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
    client_id: input.clientId,
  });
}

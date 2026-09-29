import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config.js";
import {
  MemoryOAuth2TokenStore,
  OAuth2TokenManager,
  X_OAUTH2_SCOPES,
  X_OAUTH2_TOKEN_URL,
  authorizationCodeBody,
  basicAuthHeader,
  buildAuthorizeUrl,
  createPkcePair,
  pickNewerToken,
  requestOAuth2Token,
} from "./oauth2.js";

const NOW = new Date("2026-09-29T16:00:00.000Z");

function tokenResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("OAuth 2.0 user context", () => {
  it("builds a PKCE S256 challenge and an authorize URL with the Lens scopes", () => {
    const pair = createPkcePair();
    expect(pair.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pair.challenge).toBe(createHash("sha256").update(pair.verifier).digest("base64url"));
    const url = new URL(
      buildAuthorizeUrl({
        clientId: "client",
        redirectUri: "http://127.0.0.1:4391/callback",
        state: pair.state,
        codeChallenge: pair.challenge,
      }),
    );
    expect(url.origin + url.pathname).toBe("https://twitter.com/i/oauth2/authorize");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(pair.challenge);
    expect(url.searchParams.get("scope")).toBe(X_OAUTH2_SCOPES.join(" "));
    expect(url.searchParams.get("state")).toBe(pair.state);
  });

  it("posts a refresh_token grant to api.x.com with confidential-client basic auth", async () => {
    const fetchImpl = vi.fn(async () =>
      tokenResponse({ access_token: "access-2", refresh_token: "refresh-2", expires_in: 7200 }),
    );
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: "refresh-1",
      client_id: "client",
    });
    const minted = await requestOAuth2Token({
      clientId: "client",
      clientSecret: "secret",
      body,
      fetchImpl,
    });
    expect(minted).toEqual({ accessToken: "access-2", refreshToken: "refresh-2", expiresIn: 7200 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(X_OAUTH2_TOKEN_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(basicAuthHeader("client", "secret"));
    expect(init.body).toContain("grant_type=refresh_token");
    expect(init.body).toContain("refresh_token=refresh-1");
  });

  it("keeps a stored refresh token ahead of the env seed and writes the rotated pair", async () => {
    const store = new MemoryOAuth2TokenStore();
    await store.write({
      accessToken: "stale-access",
      refreshToken: "stored-refresh",
      expiresAt: "2026-09-29T15:00:00.000Z",
      updatedAt: "2026-09-29T14:00:00.000Z",
    });
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      expect(String(init.body)).toContain("refresh_token=stored-refresh");
      expect(String(init.body)).not.toContain("env-refresh");
      return tokenResponse({ access_token: "access-2", refresh_token: "refresh-2", expires_in: 7200 });
    });
    const manager = new OAuth2TokenManager({
      clientId: "client",
      clientSecret: "secret",
      envRefreshToken: "env-refresh",
      store,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => NOW,
    });
    expect(await manager.getAccessToken()).toBe("access-2");
    const saved = await store.read();
    expect(saved?.refreshToken).toBe("refresh-2");
    expect(saved?.expiresAt).toBe("2026-09-29T18:00:00.000Z");
    expect(await manager.getAccessToken()).toBe("access-2");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("refreshes from the env token when the store is empty, and does not save a failed refresh", async () => {
    const store = new MemoryOAuth2TokenStore();
    const fetchImpl = vi.fn(async () =>
      tokenResponse({ error: "invalid_request", error_description: "bad env-refresh-secret" }, 400),
    );
    const manager = new OAuth2TokenManager({
      clientId: "client",
      clientSecret: "secret",
      envRefreshToken: "env-refresh-secret",
      store,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => NOW,
    });
    await expect(manager.getAccessToken()).rejects.toThrow(/token request failed/);
    await expect(manager.getAccessToken()).rejects.not.toThrow(/env-refresh-secret/);
    expect(await store.read()).toBeNull();
  });

  it("forces a refresh when the stored access token is still inside its window", async () => {
    const store = new MemoryOAuth2TokenStore();
    await store.write({
      accessToken: "still-good",
      refreshToken: "stored-refresh",
      expiresAt: "2026-09-29T18:00:00.000Z",
      updatedAt: "2026-09-29T16:00:00.000Z",
    });
    const fetchImpl = vi.fn(async () =>
      tokenResponse({ access_token: "after-401", refresh_token: "after-401-refresh", expires_in: 7200 }),
    );
    const manager = new OAuth2TokenManager({
      clientId: "client",
      clientSecret: "secret",
      store,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => NOW,
    });
    expect(await manager.getAccessToken()).toBe("still-good");
    expect(await manager.getAccessToken(true)).toBe("after-401");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("sends the authorization code with the PKCE verifier", () => {
    const body = authorizationCodeBody({
      clientId: "client",
      code: "code-1",
      redirectUri: "http://127.0.0.1:4391/callback",
      codeVerifier: "verifier-1",
    });
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code_verifier")).toBe("verifier-1");
    expect(body.get("redirect_uri")).toBe("http://127.0.0.1:4391/callback");
  });

  it("prefers the token record that was written later", () => {
    const older = {
      accessToken: "a",
      refreshToken: "r1",
      expiresAt: "2026-09-29T18:00:00.000Z",
      updatedAt: "2026-09-29T15:00:00.000Z",
    };
    const newer = { ...older, accessToken: "b", refreshToken: "r2", updatedAt: "2026-09-29T16:00:00.000Z" };
    expect(pickNewerToken(older, newer)?.refreshToken).toBe("r2");
    expect(pickNewerToken(newer, null)?.refreshToken).toBe("r2");
  });

  it("selects oauth2 from X_AUTH_MODE and leaves oauth1 as the default", () => {
    expect(loadConfig({}).xAuthMode).toBe("oauth1");
    const config = loadConfig({
      X_AUTH_MODE: "oauth2",
      X_OAUTH2_CLIENT_ID: "client",
      X_OAUTH2_CLIENT_SECRET: "secret",
      X_OAUTH2_ACCESS_TOKEN: "access",
      X_OAUTH2_REFRESH_TOKEN: "refresh",
      X_BEARER_TOKEN: "bearer",
    });
    expect(config.xAuthMode).toBe("oauth2");
    expect(config.xOauth2ClientId).toBe("client");
    expect(config.xOauth2RefreshToken).toBe("refresh");
    expect(config.xBearerToken).toBe("bearer");
    expect(config.xOauth2RedirectUri).toBe("http://127.0.0.1:4391/callback");
    expect(() => loadConfig({ X_AUTH_MODE: "basic" })).toThrow(/oauth1 or oauth2/);
  });
});

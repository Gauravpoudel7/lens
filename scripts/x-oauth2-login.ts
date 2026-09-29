import { execSync, spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import {
  authorizationCodeBody,
  buildAuthorizeUrl,
  createPkcePair,
  loadConfig,
  log,
  requestOAuth2Token,
} from "@lens/core";
import { bootstrapEnv, createPersistedOAuth2TokenStore, repoRoot } from "@lens/db";

bootstrapEnv();
execSync("npx tsx scripts/ensure-db.ts", { cwd: repoRoot, stdio: "inherit", env: process.env });

const config = loadConfig();
if (!config.xOauth2ClientId || !config.xOauth2ClientSecret) {
  console.error("Set X_OAUTH2_CLIENT_ID and X_OAUTH2_CLIENT_SECRET in .env, then run this again.");
  process.exit(1);
}

const redirect = new URL(config.xOauth2RedirectUri);
if (redirect.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(redirect.hostname)) {
  console.error("X_OAUTH2_REDIRECT_URI must be http://127.0.0.1 or http://localhost. The default is http://127.0.0.1:4391/callback.");
  process.exit(1);
}

const pkce = createPkcePair();
const authorizeUrl = buildAuthorizeUrl({
  clientId: config.xOauth2ClientId,
  redirectUri: redirect.toString(),
  state: pkce.state,
  codeChallenge: pkce.challenge,
});

const code = await waitForCode({
  port: Number(redirect.port || 80),
  pathname: redirect.pathname,
  redirectUri: redirect.toString(),
  expectedState: pkce.state,
  authorizeUrl,
});

const minted = await requestOAuth2Token({
  clientId: config.xOauth2ClientId,
  clientSecret: config.xOauth2ClientSecret,
  body: authorizationCodeBody({
    clientId: config.xOauth2ClientId,
    code,
    redirectUri: redirect.toString(),
    codeVerifier: pkce.verifier,
  }),
});
if (!minted.refreshToken) {
  console.error("X did not return a refresh token. Add the offline.access scope on the app, then run this again.");
  process.exit(1);
}

const now = new Date();
await createPersistedOAuth2TokenStore().write({
  accessToken: minted.accessToken,
  refreshToken: minted.refreshToken,
  expiresAt: new Date(now.getTime() + minted.expiresIn * 1000).toISOString(),
  updatedAt: now.toISOString(),
});
log("x oauth2 login saved", { expiresInSec: minted.expiresIn });
console.log("Saved the X user tokens in the database and in data/x-oauth2.json.");
console.log("In .env set X_MODE=live and X_AUTH_MODE=oauth2. Do not commit .env or data/x-oauth2.json.");

function waitForCode(input: {
  port: number;
  pathname: string;
  redirectUri: string;
  expectedState: string;
  authorizeUrl: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    let server: Server;
    const finish = (err: Error | null, value?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      if (err) reject(err);
      else resolve(value ?? "");
    };
    timer = setTimeout(() => {
      finish(new Error("Timed out after 5 minutes waiting for the X callback."));
    }, 5 * 60 * 1000);
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", input.redirectUri);
      if (url.pathname !== input.pathname) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      const error = url.searchParams.get("error");
      const state = url.searchParams.get("state");
      const authCode = url.searchParams.get("code");
      if (error) {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end("<p>X did not approve the login. You can close this tab.</p>");
        finish(new Error(`X authorization failed: ${error}`));
        return;
      }
      if (state !== input.expectedState || !authCode) {
        res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        res.end("<p>The login state did not match. Close this tab and run the command again.</p>");
        finish(new Error("The OAuth state did not match. Run npm run x:oauth2-login again."));
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<p>Lens saved the X login on this machine. You can close this tab.</p>");
      finish(null, authCode);
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === "EADDRINUSE") {
        reject(new Error(`Port ${input.port} is in use. Set X_OAUTH2_REDIRECT_URI to another localhost URL.`));
        return;
      }
      reject(err);
    });
    server.listen(input.port, "127.0.0.1", () => {
      console.log("Open this URL in a browser and approve the app:");
      console.log(input.authorizeUrl);
      const opener = spawn("xdg-open", [input.authorizeUrl], { stdio: "ignore", detached: true });
      opener.on("error", () => undefined);
      opener.unref();
    });
  });
}

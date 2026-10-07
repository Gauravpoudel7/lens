# Deploy Lens

The app is one Next.js server and one worker. They share a database. SQLite is the zero-config default and is fine for a single machine. Use Postgres when web and worker run as two containers, because two processes writing one SQLite file will lock.

Proofs still default to devnet. Token reads and USDC payments use mainnet. Set `PUBLIC_BASE_URL` to the https URL users will open. The scorecard and Blinks use that URL. X replies, outbound posts, and warning DMs leave the URL out unless `X_REPLY_LINKS=true`, because a URL in an X post is billed much higher. Once that URL is a public host, link-free posts add a plain-text line, `Full report on <host>.` Set `PUBLIC_SITE_NAME` to override the host, or leave both local to omit the line. The hashed proof is still the exact text that was posted. `X_SWAP_LINKS_ON_REQUEST` defaults to true: a mention that asks to buy, swap, or trade then includes one Blink URL for a LOW or MEDIUM token, and only when `PUBLIC_BASE_URL` is a public https URL. Register that host at `https://dial.to/register` if you want X to unfurl the action. Set the flag to `false` to keep those replies link-free too.

Secrets go in the host's env, not in the image. See [docs/KEYS.md](docs/KEYS.md).

Health check: `GET /api/health`. A good process returns `ok: true` and `db: "ok"`. Logs are one JSON object per line (`time`, `level`, `service`, `msg`).

## Docker on one machine

```bash
docker compose up --build
```

Web is on port 3847. The worker uses the same image with `LENS_ROLE=worker`. Both mount a volume at `/app/data` for `lens.db`.

Postgres instead of SQLite:

```bash
docker compose --profile postgres up -d postgres
```

Then set this on **both** web and worker and start them again:

```text
DATABASE_URL=postgresql://lens:lens@postgres:5432/lens
```

On startup the container rewrites the Prisma provider to `postgresql`, runs `prisma generate`, and `prisma db push`. The committed schema file stays SQLite so local `npm run demo` does not need Postgres.

Change the Postgres password before anyone else can reach port 5432. The compose file uses `lens` / `lens` so a laptop can boot it.

## Railway, one service

This is the path for an owner who does not want to assemble two services by hand. `railway.json` tells Railway to build the Dockerfile, start `sh scripts/docker-entry.sh`, and check `/api/health`. Set `LENS_ROLE=all` and that one container runs the website and the bot together.

1. Sign up at [railway.com](https://railway.com). Logging in with GitHub is enough.
2. Click **New Project**, then **Deploy from GitHub repo**, and pick this repository. Wait until the first build finishes. It can fail until the variables below exist. That is fine.
3. Open the service. Go to **Variables**. Add these. Leave `X_MODE=mock` until step 8.

```text
LENS_ROLE=all
PORT=3847
DATA_MODE=live
PROOF_MODE=solana
SOLANA_CLUSTER=devnet
PUBLIC_BASE_URL=https://YOUR-RAILWAY-DOMAIN
HELIUS_API_KEY=
SOLANA_KEYPAIR=
X_MODE=mock
X_AUTH_MODE=oauth2
X_OAUTH2_CLIENT_ID=
X_OAUTH2_CLIENT_SECRET=
X_OAUTH2_ACCESS_TOKEN=
X_OAUTH2_REFRESH_TOKEN=
X_BOT_USER_ID=
X_REPLY_LINKS=false
# X_SWAP_LINKS_ON_REQUEST=true
POLL_INTERVAL_MS=180000
MAX_X_REPLIES_PER_DAY=50
```

`SOLANA_KEYPAIR` is the one-line JSON array from the keypair file, including the brackets. Do not upload the file.

4. Add the database. In the project, click **New**, then **Database**, then **PostgreSQL**. Open the Postgres service, copy `DATABASE_URL`, and paste it into the Lens service variables. Two processes share that database. Do not point them at one SQLite file.
5. SQLite is the other option, for a single copy of the app only. In the Lens service, **Settings**, **Volumes**, mount a volume at `/app/data`. Do not set `DATABASE_URL`. Do not add a second service. Postgres is the one to use once the bot and the site both write.
6. On your own computer, in this repo, run `npm run x:oauth2-login`. Approve the app in the browser. The script writes the tokens into `.env` on that computer. Copy `X_OAUTH2_ACCESS_TOKEN` and `X_OAUTH2_REFRESH_TOKEN` into the Railway variables. Do not commit `.env`. Do not paste the tokens into chat.
7. Copy the public URL Railway shows (Settings, Networking, Generate Domain) into `PUBLIC_BASE_URL`, then redeploy.
8. On your computer run `npm run doctor`. It prints `ready` or `not-ready` for each check and does not post. When you want it to call X once, run `npm run doctor -- --x`. That is a read of who the token belongs to. It does not tweet. When the list says `Ready.`, set `X_MODE=live` on Railway and redeploy.

`OUTBOUND_ENABLED=true` is optional and off by default. Turn it on only when you also want scheduled posts. Leave `X_REPLY_LINKS=false`.

Do not run a second worker. `LENS_ROLE=all` already starts one. A separate worker service is only for splitting them later: same variables, `LENS_ROLE=worker`, and no public domain.

## Fly.io

`fly.toml` in the repo defines a `web` process and a `worker` process. The worker command sets `LENS_ROLE=worker`.

```bash
fly launch --no-deploy
fly postgres create --name lens-db
fly postgres attach lens-db
fly secrets set \
  PUBLIC_BASE_URL=https://YOUR_APP.fly.dev \
  DATA_MODE=live \
  PROOF_MODE=solana \
  SOLANA_CLUSTER=devnet \
  SOLANA_KEYPAIR='[ ...json array... ]' \
  HELIUS_API_KEY=... \
  X_MODE=live \
  X_AUTH_MODE=oauth2 \
  X_OAUTH2_CLIENT_ID=... \
  X_OAUTH2_CLIENT_SECRET=... \
  X_OAUTH2_REFRESH_TOKEN=...
fly deploy
fly scale count web=1 worker=1
```

`fly.toml` points HTTP checks at `/api/health` and does not stop the web machine when idle, so the scorecard stays up. Confirm the app name in `fly.toml` before the first deploy.

OAuth 2.0 refresh tokens rotate. The worker writes the new pair into the database, so web and worker must share that database. The `X_OAUTH2_REFRESH_TOKEN` secret is only the first seed. For OAuth 1.0a, set `X_AUTH_MODE=oauth1` and the four user-context keys instead of the OAuth 2.0 ones.

## Render

1. New **PostgreSQL** database. Copy the internal database URL.
2. New **Web Service**, environment Docker, root directory this repo.
   - Start command: `sh scripts/docker-entry.sh`
   - Health check path: `/api/health`
   - Env: `LENS_ROLE=web`, `DATABASE_URL`, `PUBLIC_BASE_URL`, and the same keys as the Railway list.
3. New **Background Worker**, same Docker repo.
   - Start command: `sh scripts/docker-entry.sh`
   - Env: `LENS_ROLE=worker` and the same `DATABASE_URL` and keys. No public URL.

Render sets `PORT`. The web start script uses `PORT` when it is present, otherwise 3847.

## After it is up

```bash
curl https://YOUR_HOST/api/health
```

You want `"ok": true` and `"db": "ok"`. Open `/` and `/pro`. A mock banner means `DATA_MODE` or `PROOF_MODE` is still `mock`. That is honest. Switch those two env vars and redeploy when the keys are in place.

`npm run demo` on a laptop still forces mock mode. It does not touch the deployed database.

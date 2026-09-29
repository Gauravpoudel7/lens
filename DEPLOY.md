# Deploy Lens

The app is one Next.js server and one worker. They share a database. SQLite is the zero-config default and is fine for a single machine. Use Postgres when web and worker run as two containers, because two processes writing one SQLite file will lock.

Proofs still default to devnet. Token reads and USDC payments use mainnet. Set `PUBLIC_BASE_URL` to the https URL users will open. Report links are baked into the hashed reply, so a wrong base URL becomes a permanent part of the proof.

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

## Railway

1. Create a project. Add a **PostgreSQL** database. Copy its `DATABASE_URL`.
2. Add a service from this repo. Railway should detect the Dockerfile. If it asks for a start command, use `sh scripts/docker-entry.sh`.
3. Variables for the web service:
   - `LENS_ROLE=web`
   - `PORT=3847`
   - `DATABASE_URL` from the Postgres plugin
   - `PUBLIC_BASE_URL` = the public https URL Railway assigns (set it again after the first deploy if the domain was unknown)
   - `DATA_MODE=live`
   - `PROOF_MODE=solana`
   - `SOLANA_CLUSTER=devnet`
   - `SOLANA_KEYPAIR` = the JSON array from `data/devnet-keypair.json` (one line). Prefer this over a file, because the container disk is ephemeral.
   - `HELIUS_API_KEY` when you have one
   - `X_MODE=live` plus the four X user tokens when you want the bot to post
   - `PRO_TREASURY_WALLET` when you want Pro checkout
4. Settings → health check path `/api/health`. The container listens on 3847.
5. Add a second service from the same repo and Dockerfile. Same variables, except `LENS_ROLE=worker` and no public port. Give it `OUTBOUND_ENABLED=true` and `OUTBOUND_DISCOVER=true` only when you want scheduled calls. `OUTBOUND_DAILY_CAP` defaults to 8.

Do not run two workers. The poller does not take a lock.

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
  X_API_KEY=... \
  X_API_SECRET=... \
  X_ACCESS_TOKEN=... \
  X_ACCESS_SECRET=...
fly deploy
fly scale count web=1 worker=1
```

`fly.toml` points HTTP checks at `/api/health` and does not stop the web machine when idle, so the scorecard stays up. Confirm the app name in `fly.toml` before the first deploy.

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

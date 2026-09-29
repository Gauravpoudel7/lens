# Lens (@askLens)

Lens is a Solana risk bot for X. Someone tags `@askLens` under a post. Lens finds the token, runs a fixed set of on-chain checks, and replies with **LOW**, **MEDIUM**, or **HIGH** plus plain-English facts. Before that reply is posted, Lens writes the SHA-256 of the exact text and a timestamp to Solana, so the record cannot be quietly edited later. A public scorecard shows every check, the call win rate, and whether the risk labels held up.

LOW means no major red flags were found. It is not a prediction that the price will rise. Replies state facts, never the word “scam”, and always end with “Not financial advice.”

This repo is the hackathon MVP: the reply loop, the proof, the scorecard, and a Jupiter Blink that refuses to sell a buy button on HIGH-risk tokens.

## Mock mode, no keys

```bash
npm install
npm run demo
npm run dev
```

`npm run demo` forces mock mode even if `.env` says otherwise. It simulates one `@askLens` mention on the `$DANGER` fixture, proves the reply into the local record, posts an outbound `$SAFE` call, then scores both immediately (window of 0 days, using the fixture’s later price).

Then open [the scorecard](http://127.0.0.1:3847). The dev server listens on port **3847**.

Run the tests:

```bash
npm test
```

## What each command does

| Command | What it does |
| --- | --- |
| `npm run demo` | One simulated mention, end to end, in mock mode |
| `npm run setup:devnet` | Create `data/devnet-keypair.json` if needed and request devnet SOL |
| `npm run demo:devnet` | Same loop as the demo, but the memo is a real devnet transaction |
| `npm run dev` | Scorecard and HTTP API on port 3847 |
| `npm run worker` | Poll mentions, run the outbound job, score due checks |
| `npm run worker:once` | Single poll |
| `npm run post -- --mint <address>` | Outbound post. HIGH becomes a warning, LOW a call, otherwise a note |
| `npm run discover` | One outbound pass. No-op unless `OUTBOUND_ENABLED=true` |
| `npm run live:sample` | Read BONK and one current pump.fun token from mainnet |
| `npm run x:oauth2-login` | Browser PKCE login that saves X OAuth 2.0 user tokens |
| `npm run doctor` | Check config before going live. No posts. Add `-- --x` for one `users/me` read |
| `npm run score` | Score checks older than `OUTCOME_WINDOW_DAYS` |
| `npm run score -- --window-days 0` | Score everything that is still open |
| `npm test` | Risk rules, proof hash/verify, Pro payments, discovery caps |
| `npm run db:push` | Create or update the database. Postgres when `DATABASE_URL` starts with `postgres` |

The manual check form is at [http://127.0.0.1:3847/check](http://127.0.0.1:3847/check). The three buttons fill in mock fixtures (`$DANGER`, `$SAFE`, `$MID`).

## Layout

```
packages/core    rules, resolver, reply writer, proof, providers, Pro, discovery
packages/db      Prisma store and runtime wiring
apps/web         Next.js scorecard, check API, verify API, Pro page, Blink
apps/worker      mention poller, outbound job, live X client
prisma/          schema (SQLite by default; Postgres is generated at startup)
scripts/         demo, devnet proof, discovery, live sample
docs/KEYS.md     where each key comes from
DEPLOY.md        Railway, Fly, and Render
```

Future agents should read [AGENTS.md](AGENTS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/STATUS.md](docs/STATUS.md) before changing behavior.

## Environment

Defaults live in code, so a missing `.env` is valid. Copy `.env.example` when you want live services. Secrets stay in `.env`, which is gitignored. The database file `data/*.db` and keypair JSON files are gitignored too.

If `DATABASE_URL` is unset, Lens uses an absolute path to `data/lens.db`. Do not set a relative URL unless you know Prisma resolves it from `prisma/schema.prisma` (`file:../data/lens.db`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `data/lens.db` | SQLite file, or a `postgresql://` URL |
| `DATA_MODE` | `mock` | `live` uses DexScreener, Solana RPC, RugCheck, optional Birdeye |
| `PROOF_MODE` | `mock` | `solana` sends a memo before posting |
| `X_MODE` | `mock` | `live` polls and posts with the X API |
| `LLM_MODE` | `auto` | `template` skips the model even if a key is set |
| `PUBLIC_BASE_URL` | `http://127.0.0.1:3847` | Scorecard and Blink links. Omitted from X posts unless `X_REPLY_LINKS=true` |
| `SOLANA_CLUSTER` | `devnet` | Where proofs are written. Token data is still mainnet |
| `SOLANA_RPC_URL` | devnet public RPC | Proof RPC |
| `DATA_RPC_URL` | mainnet public RPC, or Helius if `HELIUS_API_KEY` is set | Mint, supply, holders |
| `HELIUS_API_KEY` | empty | Recommended mainnet RPC |
| `BIRDEYE_API_KEY` | empty | Optional security fields, including creator sold % when present |
| `LLM_API_KEY` or `OPENAI_API_KEY` | empty | Reply wording only. No tools, no wallet |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible |
| `LLM_MODEL` | `gpt-4o-mini` | Chat model |
| `X_AUTH_MODE` | `oauth1` | `oauth2` for OAuth 2.0 user context, `oauth1` for the four keys below |
| `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | empty | OAuth 1.0a user context for live posting |
| `X_OAUTH2_CLIENT_ID`, `X_OAUTH2_CLIENT_SECRET` | empty | Confidential OAuth 2.0 client. Required when `X_AUTH_MODE=oauth2` |
| `X_OAUTH2_ACCESS_TOKEN`, `X_OAUTH2_REFRESH_TOKEN` | empty | Bootstrap tokens. After a refresh, the database row is the one that works |
| `X_OAUTH2_REDIRECT_URI` | `http://127.0.0.1:4391/callback` | Must match the callback URL on the X app |
| `X_BEARER_TOKEN` | empty | Optional app-only read of a parent post. Cannot post or send a DM |
| `X_BOT_USER_ID` | empty | Optional at runtime. If empty, the worker calls `/2/users/me` once at startup, caches the id, and logs a hint to set this. `npm run doctor` wants it set before go-live |
| `X_REPLY_LINKS` | `false` | `true` puts `Report: <url>` back in replies, outbound posts, and warning DMs. Off by default because X bills a URL much higher |
| `SOLANA_KEYPAIR` or `SOLANA_KEYPAIR_PATH` | empty | Required for `PROOF_MODE=solana` |
| `RATE_LIMIT_PER_USER_PER_DAY` | `5` | Per X user, UTC day. Pro accounts skip this |
| `MAX_X_REPLIES_PER_DAY` | `50` | Bot-wide replies per UTC day. The worker stops replying when it is reached. Pro does not skip it |
| `CHECK_API_LIMIT_PER_HOUR` | `30` | Manual check form, per IP, per process |
| `OUTCOME_WINDOW_DAYS` | `7` | How long before a check is scored |
| `SHARP_DROP_PCT` | `-30` | HIGH is right if price change is at or below this |
| `CALL_WIN_PCT` | `20` | A call wins at or above this |
| `POLL_INTERVAL_MS` | `180000` | Worker poll (mentions, outbound, scoring). 180 seconds by default to save X credits |
| `RPC_RETRY_ATTEMPTS` | `4` | Retries for HTTP 429 and dropped RPC calls |
| `OUTBOUND_ENABLED` | `false` | Scheduled calls and warnings |
| `OUTBOUND_MINTS` | empty | Comma-separated mints to always consider |
| `OUTBOUND_DISCOVER` | `false` | Also read DexScreener profiles and boosts |
| `OUTBOUND_DAILY_CAP` | `8` | Calls plus warnings posted per UTC day |
| `PRO_TREASURY_WALLET` | empty | Wallet that receives Pro USDC |
| `PRO_PRICE_USDC` | `10` | Price for one Pro period |
| `PRO_PERIOD_DAYS` | `30` | How long Pro lasts after a confirmed transfer |
| `USDC_MINT` | mainnet USDC | Override only for a devnet payment test |
| `PRO_RPC_URL` | same as `DATA_RPC_URL` | Mainnet RPC used to verify the USDC transfer |
| `JUPITER_BASE_URL` | `https://api.jup.ag` | Quote, swap, and price. Paths stay `/swap/v1/quote`, `/swap/v1/swap`, and `/price/v3` |
| `JUPITER_API_KEY` | empty | Optional. Sent as `x-api-key` when set. Keyless calls work on the free tier |
| `JUPITER_FEE_BPS` | `50` | 0.5%, applied only when a fee account is set |
| `JUPITER_FEE_ACCOUNT` | empty | Jupiter referral/fee token account |

### Keys you need for a real deployment

- **Solana RPC (Helius or any mainnet URL)** for mint authority, freeze authority, supply, and top holders. Public mainnet RPC works until it rate-limits you.
- **No key** for DexScreener, RugCheck, or Jupiter. Quotes use `https://api.jup.ag` without a key. Set `JUPITER_API_KEY` only if you want the higher `x-api-key` limits from the Jupiter portal.
- **Birdeye** only if you want their security payload (creator sold percent, when the API returns it).
- **A devnet keypair with SOL** for on-chain proofs. Run `npm run setup:devnet`. The JSON array stays in `data/`, which is gitignored. If the public faucet returns 429, fund the printed pubkey from [faucet.solana.com](https://faucet.solana.com) (Devnet, GitHub login) and run the script again. Set `PROOF_MODE=solana` and `SOLANA_KEYPAIR_PATH=data/devnet-keypair.json`. Then `npm run demo:devnet`.
- **`PRO_TREASURY_WALLET`** if you want the Pro page to create a Solana Pay link. No card processor is wired up. The card rail is an interface that returns “not configured”.
- **X user tokens** and `X_MODE=live` to read mentions and post. OAuth 2.0: set `X_AUTH_MODE=oauth2`, the client id and secret, then `npm run x:oauth2-login`. OAuth 1.0a: set the API key, API secret, access token, and access secret. `docs/KEYS.md` has the clicks.
- **An OpenAI-compatible key** if you want the model to phrase replies. Without it, the template writer is used. The model never chooses the risk level.

Token reads stay on mainnet even when proofs go to devnet.

## Risk rules

The level is computed in `packages/core/src/risk/engine.ts`. Danger is worth 3, caution is worth 1.

- **HIGH** if there are 2 or more danger signs, or the score is at least 6.
- **MEDIUM** if there is 1 danger, or 2 cautions, or at least 4 checks came back unknown (a LOW with missing data is not treated as a clean pass).
- **LOW** otherwise.

Thresholds: age under 24 hours is danger, under 7 days is caution. Liquidity under $10k is danger (caution if it is locked). $10k–$50k is caution. $50k+ and unlocked is caution. Top 10 holders at 70%+ is danger, 50%+ is caution. Creator sold 40%+ is danger, 10%+ is caution. Mint or freeze authority still on is danger. Linked launch wallets at 30%+ is danger, 15%+ is caution. A “burned” or “locked” claim that the chain does not support is danger.

Known stake-pool receipt mints (JitoSOL, mSOL, bSOL, jupSOL, INF) are matched by mint address. An enabled mint authority on those mints, or a mint authority that is a stake-pool program, is noted as “stake-pool token” and is not a danger sign. A different mint that only copies the ticker is still scored normally.

Unknown creator sells do not count as danger. The fact says the sells could not be verified.

## Proof format

The memo, on the SPL memo program, is:

```text
lens:v1|<ISO-8601 timestamp>|<sha256 hex of the exact reply UTF-8>
```

The hash covers the reply text only. The timestamp sits beside it. Verify with `POST /api/verify` `{ "text", "signature" }` or the form at `/verify`. Editing one character fails verification.

## HTTP API

- `POST /api/check` `{ "input": "<mint, ticker, or post text>", "wallet"?: "<pro wallet>" }`
- `POST /api/pro/checkout` `{ "xHandle"?, "wallet"? }` returns a Solana Pay URL
- `POST /api/pro/confirm` `{ "reference" }` checks the USDC transfer and flips Pro
- `GET /api/pro/account?handle=&wallet=`
- `POST /api/pro/watch` `{ "xHandle"?, "wallet"?, "mint" }` and `DELETE` with the same fields
- `GET /api/calls`
- `GET /api/calls/:id`
- `GET /api/stats`
- `POST /api/verify` and `GET /api/verify?text=&signature=`
- `GET /api/actions/trade/:mint` Solana Action. HIGH risk returns a warning and no buy. Other levels return Jupiter buy actions when `DATA_MODE=live`.
- `POST /api/actions/trade/:mint?amount=0.1` with `{ "account": "<wallet>" }`
- `GET /actions.json`
- `GET /api/health` returns `ok`, modes, and `db`

How to obtain each key is in [docs/KEYS.md](docs/KEYS.md). How to run the Docker image on Railway, Fly, or Render is in [DEPLOY.md](DEPLOY.md).

## Pro

Free X accounts get `RATE_LIMIT_PER_USER_PER_DAY` replies (default 5). An account is Pro after a USDC transfer to `PRO_TREASURY_WALLET` includes that checkout's Solana Pay reference and at least the configured amount. Pro mentions skip the daily cap. Pro watchlist members get a DM when a checked mint is HIGH. The DM points at the report that was already proved. The risk engine does not look at who paid.

The public check form stays on an hourly IP limit. Sending the paying wallet with the form skips that limit. The wallet address is not a login. Anyone who knows a paying wallet can use it on the form. The X cap uses the author of the mention.

## Scoring

Win rate uses outbound **calls** only. A win is a price change of at least `CALL_WIN_PCT` after the window. Flats are not wins. Warnings are judged separately.

Risk-label accuracy uses every scored **LOW** and **HIGH** check (replies included). HIGH is correct when the move is at or below `SHARP_DROP_PCT`. LOW is correct when it is not. MEDIUM is left out of that rate. Sharpe is the mean of call returns divided by the sample standard deviation, for that window, and it is hidden until there are two scored calls.

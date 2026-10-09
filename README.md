# Lens (@justasklens)

Lens is a Solana risk bot for X. Someone tags `@justasklens` under a post. Lens finds the token, runs a fixed set of on-chain checks, and replies with **LOW**, **MEDIUM**, or **HIGH** plus plain-English facts. Before that reply is posted, Lens writes the SHA-256 of the exact text and a timestamp to Solana, so the record cannot be quietly edited later. A public scorecard shows every check, the call win rate, and whether the risk labels held up.

LOW means no major red flags were found. It is not a prediction that the price will rise. Replies state facts, never the word “scam”, and always end with “Not financial advice.”

This repo is the hackathon MVP: the reply loop, the proof, the scorecard, and a Jupiter Blink that refuses to sell a buy button on HIGH-risk tokens.

## Run it on a Mac

Two apps live in this repo. The website (the scorecard) is `apps/web`. The marketing page is `apps/landing`. They use different ports, so you can run both at once.

### What you need

- Node.js 20 or newer. Next.js also accepts 18.18 and 19.8. Node 22 works. npm comes with Node.
- Git, and a terminal. Use a second terminal when you want the landing page up at the same time.

Check the versions:

```bash
node -v
npm -v
```

### Install

From the repo root:

```bash
npm install
```

That installs every workspace, including the website and the landing page, and generates the Prisma client.

### Settings

Copy the example file. A missing `.env` is also fine: the defaults are mock mode and a local database.

```bash
cp .env.example .env
```

For a quick local run, leave these as they are in the example. You do not need a Helius key, a Solana keypair, or X keys.

| Name | Quick local value |
| --- | --- |
| `DATA_MODE` | `mock` |
| `PROOF_MODE` | `mock` |
| `X_MODE` | `mock` |
| `PUBLIC_BASE_URL` | `http://127.0.0.1:3847` |

Live mode uses real mainnet reads, a devnet proof, and the X API. Set the names below in `.env`. Do not commit the file. The full list is in the environment table further down, and the clicks for each key are in [docs/KEYS.md](docs/KEYS.md).

| Name | Live value |
| --- | --- |
| `DATA_MODE` | `live` |
| `PROOF_MODE` | `solana` |
| `X_MODE` | `live` |
| `HELIUS_API_KEY` | your mainnet RPC key |
| `SOLANA_KEYPAIR_PATH` | `data/devnet-keypair.json` after the devnet step below |
| `PUBLIC_BASE_URL` | the public https URL of the website, when you want real links in posts |
| `X_AUTH_MODE` | `oauth2` or `oauth1`, plus the matching X key names in `.env.example` |

`LLM_MODE=template` keeps replies on the fixed template even if a model key is present.

The landing page has its own optional file. The defaults already point at this Mac.

```bash
cp apps/landing/.env.example apps/landing/.env.local
```

Those names are `NEXT_PUBLIC_SITE_URL` (the landing page), `NEXT_PUBLIC_APP_URL` (the website), and `NEXT_PUBLIC_X_HANDLE`.

### Database

```bash
npm run db:push
```

That creates the SQLite file `data/lens.db`. The file is gitignored. `npm run dev` and `npm run demo` create it too, if you skip this step. If `DATABASE_URL` starts with `postgres`, the same command updates Postgres instead.

### Website

```bash
npm run demo
npm run dev
```

`npm run demo` forces mock mode even if `.env` says otherwise. It simulates one mention on the `$DANGER` fixture, proves the reply, posts an outbound `$SAFE` call, and scores both immediately.

Then open [http://127.0.0.1:3847](http://127.0.0.1:3847). Leave this terminal running.

### Landing page

In a second terminal, from the same repo root:

```bash
npm run dev:landing
```

Open [http://127.0.0.1:3848](http://127.0.0.1:3848). This page does not call an API, a wallet, or X. Its links go to the website on port 3847.

### Worker

The worker polls mentions, runs outbound posts, and scores old checks. In mock mode it does not call X.

```bash
npm run worker:once
npm run worker
```

`worker:once` does a single pass and exits. `worker` keeps polling until you stop it.

### Devnet proofs

```bash
npm run setup:devnet
```

This writes `data/devnet-keypair.json` (gitignored) and asks a public devnet faucet for SOL. If funding fails, the command exits with an error that starts with “Could not fund”. The log already printed the new pubkey. Fund that address from [faucet.solana.com](https://faucet.solana.com) (Devnet) and run the command again. A busy faucet often answers with HTTP 429.

Then set `PROOF_MODE=solana` and `SOLANA_KEYPAIR_PATH=data/devnet-keypair.json`, and run:

```bash
npm run demo:devnet
```

Token reads stay on mainnet. Only the proof memo goes to devnet.

### Tests and builds

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run build:landing
```

`npm run typecheck` covers the bot packages. The two build commands typecheck the website and the landing page.

### If something will not start

**Port already in use.** `npm run dev` needs port 3847. `npm run dev:landing` needs port 3848. If you see `EADDRINUSE`, a previous server is still running. Free the port, then start again:

```bash
lsof -ti :3847 | xargs kill
lsof -ti :3848 | xargs kill
```

**`package-lock.json` changed after you switched branches.** Run `npm install` so `node_modules` matches the branch you checked out. If `git status` then shows `package-lock.json` and you did not add a package, put the committed lockfile back and install again:

```bash
git checkout -- package-lock.json
npm install
```

Do not commit that drift.

## What each command does

| Command | What it does |
| --- | --- |
| `npm run demo` | One simulated mention, end to end, in mock mode |
| `npm run setup:devnet` | Create `data/devnet-keypair.json` if needed and request devnet SOL |
| `npm run demo:devnet` | Same loop as the demo, but the memo is a real devnet transaction |
| `npm run dev` | Scorecard and HTTP API on port 3847 |
| `npm run dev:landing` | Marketing landing page on port 3848 (`apps/landing`). No API, wallet, or X calls |
| `npm run worker` | Poll mentions, run the outbound job and the editorial post, score due checks |
| `npm run worker:once` | Single poll |
| `npm run post -- --mint <address>` | Outbound post. HIGH becomes a warning, LOW a call, otherwise a note |
| `npm run discover` | One outbound pass. No-op unless `OUTBOUND_ENABLED=true` |
| `npm run live:sample` | Read BONK and one current pump.fun token from mainnet |
| `npm run x:oauth2-login` | Browser PKCE login that saves X OAuth 2.0 user tokens |
| `npm run doctor` | Check every setting before going live: X, RPCs, modes, proof wallet balance, session secret, Pro network and USDC mint. Each line names the variable to set. No posts. Add `-- --x` for one `users/me` read |
| `npm run score` | Score checks older than `OUTCOME_WINDOW_DAYS` |
| `npm run score -- --window-days 0` | Score everything that is still open |
| `npm run checks:review` | List live checks made before the 2026-10-09 data fixes whose numbers cannot be backed up. Add `-- --apply` to hide them from the scorecard (proofs and report links stay) |
| `npm run editorial:preview` | Print the next tip and term, today's activity recap, and a live market recap with X weighted lengths. No proof, no post |
| `npm test` | Risk rules, proof hash/verify, Pro payments, discovery caps |
| `npm run lint` | Lint the website |
| `npm run typecheck` | Typecheck the bot packages. The Next apps are typechecked by their builds |
| `npm run build` | Production build of the website |
| `npm run build:landing` | Production build of the landing page |
| `npm run db:push` | Create or update the database. Postgres when `DATABASE_URL` starts with `postgres` |

The manual check form is at [http://127.0.0.1:3847/check](http://127.0.0.1:3847/check). The three buttons fill in mock fixtures (`$DANGER`, `$SAFE`, `$MID`).

## Layout

```
packages/core    rules, resolver, reply writer, proof, providers, Pro, discovery
packages/db      Prisma store and runtime wiring
apps/web         Next.js scorecard, check API, verify API, Pro page, Blink
apps/landing     Next.js marketing page (static, links to apps/web)
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
| `PUBLIC_BASE_URL` | `http://127.0.0.1:3847` | Scorecard and Blink links. Omitted from X posts unless `X_REPLY_LINKS=true`. A non-local host is also the plain-text “Full report on …” line when `PUBLIC_SITE_NAME` is empty |
| `PUBLIC_SITE_NAME` | empty | Plain-text place named in link-free replies, such as `Lens`. Omit it while the site is not public. Localhost does not count |
| `X_BOT_HANDLE` | `justasklens` | The bot's X handle without `@`. The site and the link-code DM step use it |
| `LENS_SESSION_SECRET` | empty | HMAC key for the 24-hour wallet session cookie on `/account`. Empty means a random key per process, so sessions end on restart. `npm run doctor` warns when it is empty |
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
| `X_SWAP_LINKS_ON_REQUEST` | `true` | A mention that says buy, swap, or trade gets one `/trade/<mint>` link when the verdict is LOW or MEDIUM and `PUBLIC_BASE_URL` is public https. HIGH and unscored tickers stay link-free. Set `false` to turn that off. These replies still count toward the daily caps |
| `SOLANA_KEYPAIR` or `SOLANA_KEYPAIR_PATH` | empty | Required for `PROOF_MODE=solana`. A relative path is read from the repo root, so the web app and the worker load the same file |
| `PROOF_SIGNER` | empty | Pubkey that must have signed a chain memo. Empty uses the proof keypair above |
| `RATE_LIMIT_PER_USER_PER_DAY` | `5` | Per X user, UTC day. Pro accounts skip this |
| `MAX_X_REPLIES_PER_DAY` | `50` | Bot-wide replies per UTC day. The worker stops replying when it is reached. Pro does not skip it |
| `CHECK_API_LIMIT_PER_HOUR` | `30` | Manual check, verify, and Blink, per `X-Real-IP`, per process. `/trade` pages share the Blink count, and only new checks count |
| `OUTCOME_WINDOW_DAYS` | `7` | How long before a check is scored |
| `SHARP_DROP_PCT` | `-30` | HIGH is right if price change is at or below this |
| `CALL_WIN_PCT` | `20` | A call wins at or above this |
| `POLL_INTERVAL_MS` | `180000` | Worker poll (mentions, outbound, scoring). 180 seconds by default to save X credits |
| `X_DM_POLL_MS` | `180000` | Minimum gap between DM reads for Pro link codes. Values below 180000 are raised to 180000. DMs are read only while a paid account has an open code |
| `RPC_RETRY_ATTEMPTS` | `4` | Retries for HTTP 429 and dropped RPC calls |
| `OUTBOUND_ENABLED` | `false` | Scheduled calls and warnings |
| `OUTBOUND_MINTS` | empty | Comma-separated mints to always consider |
| `OUTBOUND_DISCOVER` | `false` | Also read DexScreener profiles and boosts |
| `OUTBOUND_DAILY_CAP` | `8` | Calls plus warnings posted per UTC day |
| `EDITORIAL_ENABLED` | `false` | Daily tip, term, and recap posts. Proved first, no URL, no hashtag. Only posts when `X_MODE=live` |
| `EDITORIAL_KINDS` | `tip,term,recap` | Which editorial posts run |
| `EDITORIAL_MARKET_FALLBACK` | `true` | When Lens checked fewer than 3 coins today, the recap covers GeckoTerminal trending coins, risk first |
| `EDITORIAL_TIP_HOUR_UTC` | `13` | Tip slot. Hours are 0–23 and must all differ |
| `EDITORIAL_RECAP_HOUR_UTC` | `17` | Recap slot |
| `EDITORIAL_TERM_HOUR_UTC` | `22` | Term slot |
| `EDITORIAL_MAX_LATE_HOURS` | `6` | A slot later than this is skipped for the day |
| `PRO_TREASURY_WALLET` | empty | Wallet that receives Pro USDC |
| `PRO_PRICE_USDC` | `10` | Price for one Pro period. The Pro page reads this. Unset means 10 USDC |
| `PRO_PERIOD_DAYS` | `30` | How long Pro lasts after a confirmed transfer |
| `ALERT_DMS_PER_USER_PER_DAY` | `10` | Warning DMs per Pro watcher per UTC day |
| `ALERT_DMS_PER_DAY` | `100` | Warning DMs bot-wide per UTC day |
| `PRO_CHECKOUT_TTL_HOURS` | `24` | Unpaid Solana Pay checkouts older than this are reported as expired. A full USDC transfer still confirms |
| `USDC_MINT` | mainnet USDC | Override only for a devnet payment test |
| `PRO_RPC_URL` | same as `DATA_RPC_URL` | Mainnet RPC used to verify the USDC transfer |
| `JUPITER_BASE_URL` | `https://api.jup.ag` | Quote, swap, price, and the verified token list. Paths stay `/swap/v1/quote`, `/swap/v1/swap`, `/price/v3`, and `/tokens/v2/tag` |
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

## Editorial posts

With `EDITORIAL_ENABLED=true` and `X_MODE=live`, each worker poll can make one editorial post, after outbound posts. There are three a day at most, each at its UTC slot:

- **Tip** (13:00): the next of 15 safety tips (`packages/core/src/editorial/content.ts`).
- **Recap** (17:00): Lens's own day when it checked at least 3 live coins. Otherwise, with `EDITORIAL_MARKET_FALLBACK=true`, a risk-first look at GeckoTerminal trending Solana coins (mint and freeze authority, age, newest), read through the same data checks as replies. No prices, no %, no `$` before tickers. Fewer than 3 coins that pass the checks means no recap that day.
- **Term** (22:00): the next of 14 crypto terms.

Each text must fit 280 X-weighted characters (emoji, `•`, and CJK weigh 2; a URL weighs 23) and contain no URL, bare domain, hashtag, or “scam”. It is proved on Solana first, saved as `proved`, then posted. A failed post is retried with the same text up to 3 times inside `EDITORIAL_MAX_LATE_HOURS`. A row left in `proved` after a crash is never posted again on its own; the worker logs it for a human. Mock X mode only logs “would post”. Posts are stored in `EditorialPost`, not `Check`, so the win rate does not change. `/updates` lists them with their proofs.

## Risk rules

The level is computed in `packages/core/src/risk/engine.ts`. Danger is worth 3, caution is worth 1.

- **HIGH** if there are 2 or more danger signs, or the score is at least 6.
- **MEDIUM** if there is 1 danger, or 2 cautions, or at least 4 checks came back unknown, or mint authority or freeze authority could not be read (a LOW with missing data is not treated as a clean pass).
- **LOW** otherwise. A permanent delegate or a transfer fee of 5% or more cannot be LOW.

Thresholds: age under 24 hours is danger, under 7 days is caution. Liquidity under $10k is danger (caution if it is locked). $10k–$50k is caution. $50k+ and unlocked is caution. Top 10 holders at 70%+ is danger, 50%+ is caution. That top 10 skips burn addresses, Raydium’s AMM authority, and any holder whose owning program is a known pool program (Raydium v4, CPMM, CLMM, LaunchLab, Orca Whirlpool, Meteora DLMM, pools, DAMM v2, DBC, or pump.fun). RugCheck's fallback top 10 also skips the market accounts in its own report. Other holders stay in the count. Creator sold 40%+ is danger, 10%+ is caution. Mint or freeze authority still on is danger. Token-2022: a permanent delegate or accounts that start frozen is danger. A transfer fee of 5% or more is danger. A smaller fee, a transfer hook, or a non-transferable flag is caution. Linked launch wallets at 30%+ is danger, 15%+ is caution. A “locked” claim that the chain contradicts is danger. A “burned” claim is danger only when the chain shows a burn that is real but under 10%. A missing burn sample, or a zero burn, is “could not be verified,” not danger.

### Where the numbers come from

Liquidity is the sum of DexScreener pools on Solana where the mint is the base or quote token. A pool is ignored when its DEX id is not a known Solana DEX, when it reports $100k or more but traded under 0.1% of that in 24 hours, or when it is deeper than the token's FDV. RugCheck's total is only a cross-check. Pool age comes only from pools that hold the mint, and the age is the earlier of that and RugCheck's first sighting.

Before the rules run, a number that fails a plausibility check is removed and logged (`fact dropped`): liquidity that RugCheck disagrees with by more than 10x, or liquidity above FDV; a price 10x away from RugCheck's; an age under one day for a Jupiter-verified mint; a top 10 of 99% or more next to $100k or more of liquidity. A removed number is “could not be verified” on the report and is left off the X reply.

Known stake-pool receipt mints (JitoSOL, mSOL, bSOL, jupSOL, INF) are matched by mint address. An enabled mint authority on those mints, or a mint authority that is a stake-pool program, is noted as “stake-pool token” and is not a danger sign. A different mint that only copies the ticker is still scored normally.

Unknown creator sells do not count as danger. That figure is filled only when Birdeye returns it, and there is no key by default, so it is usually unknown. The report page still says the sells could not be verified. X replies leave that line out. The site does not claim a fixed set of eight checks.

### Tickers

A mention is read from the asker's own text first. The parent post is used only when the mention has no `$ticker` and no contract address. If the parent names two or more tokens, Lens asks which one. A contract address is scored as that mint. A `$ticker` is scored only when Jupiter’s verified token list has exactly one token for the symbol (`GET /tokens/v2/tag?query=verified`, no key). If none match, or several do, Lens asks for the contract address and does not pick a pool by liquidity.

`$BTC`, `$ETH`, `$XRP`, and the other non-Solana majors in `packages/core/src/tickers.ts` get a short notice instead of a risk level. `$SOL` is the native asset and is not scored. `$USDC` and `$USDT` name the canonical Solana mint (Circle and Tether) and are not scored, because those tokens keep freeze authority on and the rules would call that danger. `$WBTC`, `$WETH`, and `$WBNB` are the same kind of notice. Paste the mint to check a specific token, including a wrapped one or a copy.

## Proof format

The memo, on the SPL memo program, is:

```text
lens:v1|<ISO-8601 timestamp>|<sha256 hex of the exact reply UTF-8>
```

The hash covers the reply text only. The timestamp sits beside it. Verify with `POST /api/verify` `{ "text", "signature" }` or the form at `/verify`. Editing one character fails verification.

## HTTP API

- `POST /api/check` `{ "input": "<mint, ticker, or post text>", "wallet"?: "<pro wallet>" }`
- `POST /api/pro/checkout` `{ "wallet" }` returns a Solana Pay URL. A handle is refused; X is linked by DM code after payment
- `POST /api/pro/checkout/tx` `{ "reference", "account" }` returns the unsigned USDC transfer (base64) and the payment network, after checking balances and simulating it on `PRO_RPC_URL`
- `GET /api/pro/network` returns `mainnet-beta`, `devnet`, or `unknown` from the genesis hash of `PRO_RPC_URL`
- `POST /api/pro/confirm` `{ "reference" }` checks the USDC transfer and flips Pro. Not paid yet is HTTP 202 with `reason: "pending"`. The reply carries only the paying wallet
- `POST /api/pro/nonce` `{ "wallet" }`, then `POST /api/pro/session` `{ "wallet", "nonce", "expiresAt", "signature" }` sets a 24-hour httpOnly `lens_session` cookie. `DELETE /api/pro/session` signs out
- `GET /api/pro/account` with the cookie returns that wallet's plan, link code, and watchlist. With `?handle=` or `?wallet=` it returns only whether that account is Pro
- `POST /api/pro/watch` and `DELETE` `{ "mint" }` need the cookie of an active Pro wallet and a same-site `Origin`
- `GET /api/calls`
- `GET /api/calls/:id`
- `GET /api/stats`
- `POST /api/verify` and `GET /api/verify?text=&signature=`
- `GET /trade/:mint` Buy page for people. Shows the token, its risk level, up to three facts, and a “Buy on Jupiter” button that opens `jup.ag/swap?sell=<SOL>&buy=<mint>` in a new tab. HIGH has no button and no Jupiter link. An invalid address shows a short notice and runs nothing. It reuses a check from the last 15 minutes; a new one counts against the same hourly limit as the Blink route and is a `blink` check, so it stays off the public record. Lens never touches a wallet on this page. `actions.json` maps `/trade/*` to `/api/actions/trade/*`, so Blink-aware clients turn the same link into the Action.
- `GET /api/actions/trade/:mint` Solana Action. HIGH risk returns a warning and no buy. Other levels return Jupiter buy actions when `DATA_MODE=live`.
- `POST /api/actions/trade/:mint?amount=0.1` with `{ "account": "<wallet>" }` returns `{ "transaction", "message" }`.
- `GET /actions.json` and `OPTIONS /actions.json` map `/api/actions/**` to itself and send `Access-Control-Allow-Origin: *`.

X does not unfurl that Blink in the feed until the host is in Dialect's Actions Registry. Apply at [https://dial.to/register](https://dial.to/register). Until then the URL is an ordinary link. Wallets can still open it, and Dialect's dial.to interstitial will render the action. The Solana Actions docs describe the Blinks Inspector for checking the GET and POST payloads before you apply.
- `GET /api/health` returns `ok`, modes, and `db`

How to obtain each key is in [docs/KEYS.md](docs/KEYS.md). How to run the Docker image on Railway, Fly, or Render is in [DEPLOY.md](DEPLOY.md).

## Pro

Free X accounts get `RATE_LIMIT_PER_USER_PER_DAY` replies (default 5). An account is Pro after a USDC transfer to `PRO_TREASURY_WALLET` includes that checkout's Solana Pay reference and at least the configured amount. Pro mentions from a linked X account skip the daily cap. Linked Pro watchlist members get a DM when a checked mint is HIGH. The DM points at the report that was already proved. The risk engine does not look at who paid.

The Pro page reads `PRO_PRICE_USDC` (default 10 when unset), `PRO_PERIOD_DAYS` (default 30), and `RATE_LIMIT_PER_USER_PER_DAY`. An unpaid checkout older than `PRO_CHECKOUT_TTL_HOURS` (default 24) is reported as expired. A transfer that includes the reference but sends less than the price is reported as the wrong amount. A reference Lens never issued is reported as not found. A full transfer still confirms after the window. `/account` looks up the plan by X handle or wallet. There is no password. Lens does not hold the USDC.

The public check form, `/api/verify`, and the Blink trade route share an hourly limit of `CHECK_API_LIMIT_PER_HOUR` (default 30), counted separately. The key is Railway’s `X-Real-IP` header, which the public edge overwrites, so a caller cannot pick their own address. `X-Forwarded-For` is ignored. With no `X-Real-IP` (local `npm run dev`) everyone shares one bucket. The counters live in memory, capped at 5,000 keys, and reset with the process. A wallet on the form does not skip the limit. The X cap uses the author of the mention. Checkout will not attach a new wallet or handle to an account that already exists. One transaction signature can pay only one checkout. Renewing early adds the period onto the current end date.

Pro is bought by wallet. `POST /api/pro/checkout` takes `{ "wallet" }` only and refuses a handle. After the transfer confirms, the wallet owner signs once on `/account` and sees a one-time code (`LENS-XXXX-XXXX`, 24 hours). The code is never returned without that signature, because the Solana Pay reference is public on-chain and anyone can call confirm. The owner DMs the code to the bot. The worker reads DMs (`GET /2/dm_events`) only while some paid account has an open code, and at most every `X_DM_POLL_MS` (default and minimum 180000). A valid code links the sending X user id and handle to the paid account and the bot replies once: “Linked. Lens Pro is on for @handle.” Wrong, expired, and already-used codes get a short reply; after 5 failures in a UTC day an X account's DMs are ignored. A code from an X account or handle that already belongs to another wallet is refused. An older wallet-less record for the same handle is folded into the paid account. Nothing else links a handle: mentions never attach an X id, and Pro perks (no daily cap, warning DMs) need that DM link.

`/account` shows whether a handle or wallet is Pro to anyone. Wallet, X id, expiry, the link code, and the watchlist need a signed message from that wallet (`Lens account proof`, single-use nonce, expiry), which starts a 24-hour session cookie. The same session is required to add or remove a watch. Warning DMs are limited to one per watcher per mint per UTC day, `ALERT_DMS_PER_USER_PER_DAY` (10) per watcher per day, and `ALERT_DMS_PER_DAY` (100) for the bot per day.

The home record and `/api/stats` count replies and outbound posts (`reply`, `call`, `warning`, `note`). Blink loads and the web form stay on their own report URLs so they cannot push those rows out of the last 500.

Chain memos verify only when a signer is the proof wallet (`PROOF_SIGNER`, or the pubkey of `SOLANA_KEYPAIR` / `SOLANA_KEYPAIR_PATH`). Mock memos still verify in demo mode. If neither signer is set, a real memo does not verify.

## Scoring

Win rate uses outbound **calls** only. A win is a price change of at least `CALL_WIN_PCT` after the window. Flats are not wins. Warnings are judged separately.

Risk-label accuracy uses every scored **LOW** and **HIGH** check (replies included). HIGH is correct when the move is at or below `SHARP_DROP_PCT`. LOW is correct when it is not. MEDIUM is left out of that rate. Sharpe is the mean of call returns divided by the sample standard deviation, for that window, and it is hidden until there are two scored calls.

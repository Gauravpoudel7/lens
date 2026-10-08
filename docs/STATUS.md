# Status

Updated after a live mainnet scoring run, real devnet memos, and a read-only X OAuth 2.0 check. “Done” means the path works without a paid key, or the live path was executed and the result is written here. Mock mode stays labeled. Secrets stay in `.env` and are not copied here.

X replies, outbound posts, and warning DMs are link-free unless `X_REPLY_LINKS=true`. They do not say “Full report on our scorecard.” unless a public site is configured: set `PUBLIC_SITE_NAME`, or set `PUBLIC_BASE_URL` to a non-local host, and the closer is plain text (`Full report on <name>.`). A localhost URL does not count. `X_SWAP_LINKS_ON_REQUEST` defaults to true. A mention that says buy, swap, or trade can then include one Blink URL for a LOW or MEDIUM token, and only when `PUBLIC_BASE_URL` is a public https URL. HIGH and unscored tickers stay link-free. Those replies still count toward the daily caps. The worker poll defaults to 180 seconds. Jupiter defaults to `https://api.jup.ag` (same `/swap/v1` and `/price/v3` paths, plus `GET /tokens/v2/tag?query=verified` for tickers; `JUPITER_API_KEY` is optional). `X_BOT_USER_ID` is read from the environment or from a saved cursor; `/2/users/me` runs once per process only when both are empty.

## PRD features

| # | Feature | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Token calls | Must | Done | `publishOutbound` proves, then posts. LOW is a call. The worker runs `runOutboundCycle` when `OUTBOUND_ENABLED=true`. `OUTBOUND_DISCOVER=true` adds DexScreener profiles and boosts. Daily cap is `OUTBOUND_DAILY_CAP` (default 8). MEDIUM discoveries are not posted. |
| 2 | Warnings | Must | Done | HIGH outbound posts are kind `warning`. The same proved reply is what gets posted. |
| 3 | @askLens replies | Must | Live replies sent | Poll, dedupe, free daily cap, Pro bypass, prove, then reply. On 2026-10-07 mention reads and replies worked as @justasklens. See “Live X replies” below. A `$ticker` is scored only when Jupiter lists exactly one verified token. |
| 4 | On-chain proof | Must | Done on devnet | Mock is still the default for `npm run demo`. Five live checks below each have a confirmed devnet memo. `POST /api/verify` matched the Bonk reply to its memo. |
| 5 | Public scorecard | Must | Done | Home shows win rate, label accuracy, how steady the calls were, and recent checks, with an empty state when nothing is scored. Report leads with the verdict and a text label, the mint, plain-language facts, and the proof. A ticker that is not scored shows that notice instead of a level. Mock stays labeled. |
| 6 | Trade button (Blink) | Should | Done | Reply swap links open `/trade/<mint>`, a plain page with a Jupiter link (no Blinks extension needed). HIGH has no buy. Jupiter runs only when `DATA_MODE=live`. `actions.json` is served with CORS. X unfurling needs Dialect registry approval. |
| 7 | Pro alerts | Could | Done, payment live path untested with a real USDC transfer; DM linking untested against live X | Pro is bought by wallet. The X account is linked only by DMing a one-time code (`LENS-XXXX-XXXX`, 24 h) shown on `/account` after a wallet signature; the worker reads DMs at most every 3 minutes and only while a code is open. Perks (no daily cap, warning DMs) need that link. Watchlist on `/account`, DM on HIGH through `XClient.sendDm` (mock in tests). USDC Solana Pay reference transfer, verified from token balance changes. A missing reference, a short amount, or an expired unpaid link does not start Pro. Card rail exists and refuses checkout. |

## Landing page, 2026-10-08

`apps/landing` (`@lens/landing`, port 3848, `npm run dev:landing`) is a static marketing page. It does not call any API, wallet, or X. Links to the record, `/verify`, `/check`, and `/pro` use `NEXT_PUBLIC_APP_URL`. The handle is `NEXT_PUBLIC_X_HANDLE` (default `justasklens`). The scorecard header uses the same aperture mark. The favicon matches the landing icon. `mark.png` is that mark for Blinks.

| Part | Status | Notes |
| --- | --- | --- |
| Sections, copy, motion | Done | Page-wide particle canvas (cursor vortex, still frame under reduced motion). Text without a card sits on a feathered dark plate (`.text-scrim`) so particles fade behind the words. Hero: Spline 3D sized from the column width, with a transparent margin on the left so the hands are not cropped when the robot turns, Lens mark beside it, poster fallback when 3D is skipped or the scene file fails to load; the scene file is preloaded only for screens at least 768px wide that allow motion, the camera starts at a mid shot so Spline’s own pull-back intro plays without cropping the arms, the robot sits vertically centered with its head level with the headline, and its head follows the cursor anywhere on the page. Background particles swirl only while the cursor moves. The 3D scene pauses rendering while the hero is scrolled out of view, and the particle loop draws without per-frame allocations (same pixels). Then sources marquee, problem, features, how it works with the 8-check table, feed, verify demo, stats, sample posts, pricing, CTA, footer. No FAQ. Copy is kept short. Reduced motion shows static content and no 3D. |
| Verify demo | Done | Client-side SHA-256 with `crypto.subtle`. Same `lens:v1` shape as `proof/hash.ts`, not imported from it. |
| Feed examples | Illustrative | `$SAFE`, `$MID`, `$DANGER` fixtures, labeled on the page. Signatures are fake (`Ex1a…mpLe1`). |
| Testimonials | Placeholder | Three sample posts in `apps/landing/content/placeholders.ts`, tagged on the page. The made-up usage numbers were removed. The page still says “8 checks.” Creator-sold percent is unknown unless `BIRDEYE_API_KEY` is set, so the product copy does not treat that figure as always available. Landing copy was left unchanged. |
| Spline scene | Placeholder | The spec's demo robot scene. Swap for a Lens scene in `content/copy.ts`. |
| Domain, docs, GitHub links | Not set | `NEXT_PUBLIC_SITE_URL`, footer `// TODO` links. |

The hero headline is four fixed lines sized from its column (container query), checked at 320–1920px and at browser zoom 50–300% with no horizontal scroll. Checked on a production build: `next build` and `eslint` clean. Lighthouse mobile 94 / 100 / 100 / 100, desktop 99 / 100 / 96 / 100 (performance, accessibility, best practices, SEO). Best practices on desktop loses points for a THREE.TSL console error from the Spline runtime in headless Chrome without a GPU. No horizontal scroll at 375, 390, 768, 1024, 1440, or 1920 px.

## Live X replies, 2026-10-07

Mention reads and replies ran live as @justasklens (`X_MODE=live`, OAuth 2.0, `X_REPLY_LINKS=false`). `DATA_MODE=live`. Proofs were `PROOF_MODE=solana` on devnet. The signer was `84kujKJFvEM1VeFFGCaNWr79fazi9ABoaxmcsS2oLT7S`. That secret is only in the local `.env`. It is not in git.

Replies went out on a BONK post and an XRP post. The BONK reply was a scored LOW. The XRP reply scored a Solana token named XRP as MEDIUM. A `$JUP` ask was scored HIGH against a copycat, not Jupiter (`JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN`). The copycat was about 142 days old, top 10 held 100%, freeze authority was on, and liquidity was reported at about $40.46M. The real JUP is about 974 days old, with mint and freeze off and top 10 about 66%.

Cause: ticker search called DexScreener and `parseDexSearch` kept Solana pairs with that symbol, then sorted by `liquidity.usd`. On 2026-10-07 that search ranked `JUPrJXKV6MyLkbFgZMDXPn7mYR4yqMNn5Pwg27zcyyG` first, at about $40.46M, ahead of the real JUP pool at about $2.2M. That liquidity figure is the pool’s reported number. It is not a check that the token is the canonical one.

What changed after those replies:

- A `$ticker` resolves only when Jupiter’s verified list (`GET /tokens/v2/tag?query=verified` on `JUPITER_BASE_URL`, no key) has exactly one token for that symbol. A leading `$` on the Jupiter symbol is ignored, so `WIF` matches `$WIF`. Zero matches, or more than one, are not scored. The reply asks for the contract address.
- A mint in the post is still scored as that mint.
- Bare tickers for non-Solana majors (BTC, ETH, XRP, and the set in `packages/core/src/tickers.ts`) get a short notice that Lens can’t check them. `$SOL` is the native asset and is not scored. `$USDC` and `$USDT` name the verified Solana mint and are not scored, because freeze authority on those stablecoins would read as danger. `WBTC`, `WETH`, and `WBNB` are not scored. Paste a mint to check a specific token, including a wrapped one.
- Scored replies include a short mint (`JUPy…DvCN`). Unknown facts stay on the report page and are left off the X reply. The incomplete-data line stays when missing checks changed the level.
- The scorecard closer is omitted until `PUBLIC_SITE_NAME` or a public `PUBLIC_BASE_URL` is set. No new env var is required for the current Mac setup.

## Devnet memo

On 2026-09-29, five live checks were proved with `PROOF_MODE=solana` on devnet. The signer was `CYtTTom3Ksntde8kE8HcCZpiKg45kwHTq9e9frxAtXZY` (about 10 SOL before the memos). That secret is only in the local `.env`. It is not in git.

`POST /api/verify` for the Bonk reply and its signature returned `ok: true`, reason “Text matches the stored hash.”, cluster `devnet`, chain time `2026-09-29T16:54:49.000Z`.

| Token | Level | Signature |
| --- | --- | --- |
| Bonk | LOW | [5sEJjpHesaQ1KekSa2iozmZryTrceJ68W1sstokFfHLBevpQeoy9JzhkbxUyyJn66VvLDrun1qLUwQjejWQGXPS5](https://explorer.solana.com/tx/5sEJjpHesaQ1KekSa2iozmZryTrceJ68W1sstokFfHLBevpQeoy9JzhkbxUyyJn66VvLDrun1qLUwQjejWQGXPS5?cluster=devnet) |
| JitoSOL | MEDIUM | [4r963RJcQwrF9ifWLBpV9gMr4aMS8ZKMJBD6KznWU1NwjyK9cwM5gQJFETwHQfLtjZNtHb5HTcdaFnZX5HiW4sEf](https://explorer.solana.com/tx/4r963RJcQwrF9ifWLBpV9gMr4aMS8ZKMJBD6KznWU1NwjyK9cwM5gQJFETwHQfLtjZNtHb5HTcdaFnZX5HiW4sEf?cluster=devnet) |
| JUP | LOW | [65RhEdeBahbgu1WmNar3LzBG2GVYizyHuYmP5t5eR95rCBRxq8ytXiM99R773LPvJkb2A21FmD2Kc9wk9df48vaC](https://explorer.solana.com/tx/65RhEdeBahbgu1WmNar3LzBG2GVYizyHuYmP5t5eR95rCBRxq8ytXiM99R773LPvJkb2A21FmD2Kc9wk9df48vaC?cluster=devnet) |
| Pillheads | HIGH | [2X8mF68rh1EPk6xdCeUNc81Wkaksz7qdhVDWgk7His5BmGcV9QFCZgAZ6u2c3zt3sXAcrD8JZMKwNx748tK8a4oV](https://explorer.solana.com/tx/2X8mF68rh1EPk6xdCeUNc81Wkaksz7qdhVDWgk7His5BmGcV9QFCZgAZ6u2c3zt3sXAcrD8JZMKwNx748tK8a4oV?cluster=devnet) |
| XMR20 | MEDIUM | [5jeQBpRkQYmcYkS5cLu9UnEgVo34dgBqWw2KuWa4kJHcwBcJy2uyyRysaXzRncQabEhnfr99KSAbjg1BUUXYmhaa](https://explorer.solana.com/tx/5jeQBpRkQYmcYkS5cLu9UnEgVo34dgBqWw2KuWa4kJHcwBcJy2uyyRysaXzRncQabEhnfr99KSAbjg1BUUXYmhaa?cluster=devnet) |

The earlier generated file `data/devnet-keypair.json` (pubkey `3qtAA6DHz3ufStouNS92k7sCehiuB89S3rzGWb1ZVAC2`) is still unfunded and was not used for these transactions. `npm run setup:devnet` still cannot airdrop from this IP (public faucet HTTP 429).

## Live scored checks

Same run, `DATA_MODE=live`, Helius for mainnet RPC, DexScreener and RugCheck. Reports are saved in the local database. No code bug turned up. JitoSOL is MEDIUM because its mint authority is still on, which the rules treat as danger. That is normal for a stake-pool token, and the rules do not special-case it.

| Token | Mint | Level | What the rules used |
| --- | --- | --- | --- |
| Bonk | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` | LOW | About 1379 days old. Liquidity about $413k. Top 10 about 38.6%. Mint and freeze off. Creator sells unknown. Report `/r/HMTjmL8xgt`. |
| JitoSOL | `J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn` | MEDIUM | About 1402 days old. Liquidity about $6.8M. Top 10 about 33%. Mint authority on. Freeze off. Report `/r/rYgW6ZpPWg`. That MEDIUM was this run’s rules. Known stake-pool mints no longer count that mint authority as danger. |
| JUP | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` | LOW | About 974 days old. Liquidity about $2.0M. Top 10 about 66% (caution). Mint and freeze off. Report `/r/9dei7Uz7Cy`. |
| Pillheads | `CQ6hoX3mbM7yHwHeGYSdLutQYVrrPaRAWEgY6GeAmMKH` | HIGH | DexScreener latest profile. About 1 hour old. Liquidity about $43k. Top 10 about 86%. Mint and freeze off. Report `/r/SEWKTWDVEW`. |
| XMR20 | `Cy5TzDyJ4mo6MBAbpwUcAgdfNiXYKrYUPrvhPGVU6XMR` | MEDIUM | DexScreener latest profile. About 1 hour old. Liquidity about $24k. Top 10 about 46%. Mint and freeze off. Report `/r/CCvCbRgSpp`. |

## X OAuth 2.0

Read-only calls on 2026-09-29, user context for @perma_10 (user id `2100996843262169088`, display name Perma). No tweet, reply, or DM was sent.

| Call | Result |
| --- | --- |
| `GET /2/users/me` | HTTP 200. Handle `perma_10`. Rate limit 75, 74 remaining. |
| `GET /2/users/:id/mentions` | HTTP 402. Title “Payment Required”. Detail “credits depleted”. |
| App-only bearer `GET /2/users/by/username/perma_10` | HTTP 402. Same “credits depleted” error. |
| Refresh `POST /2/oauth2/token` with `grant_type=refresh_token` | Succeeded. The new access token and refresh token were written to `XOAuth2Token` and `data/x-oauth2.json`. A second `GET /2/users/me` with the new access token returned HTTP 200 for `perma_10`. Access token expiry stored as `2026-09-29T18:55:55.321Z`. |

Posting still needs an X API plan with credits, and an explicit decision to let the worker send replies.

## Live mainnet reads

`npm run live:sample` on 2026-09-29, public mainnet RPC, no Helius key.

| Token | Mint | What came back |
| --- | --- | --- |
| Bonk | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` | Created 2022-12-20. Price about $0.000003714. Liquidity about $421,911. LP lock unknown. Top 10 about 38.7%. Mint and freeze off. Sniper about 0.09%. Burned 0%. Sources: DexScreener, Solana RPC, RugCheck. |
| PUMPKIN HEAD (pump.fun) | `5U2xu35J4LmURGsxCPZi1ZWSBRkKExcNKkmv5Zr8pump` | Created 2026-09-21. Price about $0.00001331. Liquidity about $6,905. LP lock unknown. Top 10 about 84.3%. Mint and freeze off. Sniper 0%. Burned 0%. Sources: DexScreener, Solana RPC, RugCheck. |

That sample used the public RPC. `getTokenLargestAccounts` returned HTTP 429 after 4 attempts, so holder percent fell through to RugCheck. The scored run above used Helius and got holder percent from RPC.

## Loop checklist

| Step | Status | Real or mocked |
| --- | --- | --- |
| 1. Resolver | Done | A mint is exact. A `$ticker` needs exactly one Jupiter-verified token. DexScreener liquidity is not used to pick a symbol. |
| 2. Risk engine | Done | Deterministic. Live fields from DexScreener, Solana RPC, RugCheck, optional Birdeye, Jupiter price. |
| 3. Reply writer | Done | Template unless an LLM key is set and `LLM_MODE` is not `template`. Scored replies name a short mint. Unknown facts are omitted. Posted text has no URL unless `X_REPLY_LINKS=true`, or a mention asks to buy, swap, or trade and the swap-link rules allow one Blink URL. The scorecard line is omitted until a public site name or URL is set. |
| 4. Proof | Done | Five devnet memos in the section above. `npm run demo` stays mock. |
| 5. X bot | Live replies sent | 2026-10-07 mention reads and replies worked as @justasklens (a BONK post and an XRP post). The September read-only check for @perma_10 is still recorded below. |
| 6. Database and outcome job | Done | SQLite by default. Postgres when `DATABASE_URL` starts with `postgres`. |
| 7. Scorecard, report, check form, HTTP API | Done | Port 3847. Record, report, check, verify, `/pro`, and `/account`. The check form and an unscored report show ticker notices (several coins, non-Solana, SOL, stablecoins) instead of a level. `/pro` creates a Solana Pay link when `PRO_TREASURY_WALLET` is set. |
| 8. Blink | Done | Jupiter buy path needs `DATA_MODE=live`. `GET` and `OPTIONS /actions.json` send `Access-Control-Allow-Origin: *`. Trade `GET`/`POST` follow the Actions response shapes. X feed unfurling is not live until Dialect approves the host. |
| 9. Pro | Done in tests | Chain verifier is real code. Checkout reports not found, a short amount, and an expired unpaid link (`PRO_CHECKOUT_TTL_HOURS`, default 24). A full transfer still confirms after that window. The site reads price and limits from config and does not print those variable names. No USDC was sent from this environment. |
| 10. Scheduled outbound | Done in tests | Worker calls it each poll. Off unless `OUTBOUND_ENABLED=true`. |

## Mocked vs real

| Concern | Mock default | Live when configured |
| --- | --- | --- |
| Token facts | Fixtures `$DANGER`, `$SAFE`, `$MID`, plus synthetic mints | DexScreener, mainnet RPC, RugCheck, optional Birdeye, Jupiter price. `$ticker` identity is the Jupiter verified list, not DexScreener search |
| Reply text | Template | Template, or LLM if a key is set |
| Proof | `mock_` signature in `ChainMemo` | Memo on `SOLANA_CLUSTER` |
| X posts and DMs | `MockXClient` | `twitter-api-v2` with OAuth 1.0a, or OAuth 2.0 user context. Refresh tokens are saved in `XOAuth2Token` and `data/x-oauth2.json`. DMs need DM permission on the app |
| Pro payment | Tests inject a fake chain | `getTransaction` on `PRO_RPC_URL` for a USDC balance increase |
| Jupiter swap | Error string, no fake transaction | `https://api.jup.ag` `/swap/v1`. Optional `x-api-key` |
| Card checkout | `createCardRail` throws | Not built |

The scorecard banner stays up while data or proof mode is mock.

## Known limits

- Token age is the earliest pool time DexScreener returned, or RugCheck `detectedAt`, whichever is older. It is not the mint’s first slot.
- Creator sold percent is only filled when Birdeye returns it. Unknown sells are not danger. The landing page still says “8 checks”; that line was not edited. README and the scorecard do not claim eight checks are always present.
- Sniper percent is RugCheck’s insider-network holding, or a Birdeye field when present.
- LP lock is a heuristic. Concentrated-liquidity pools stay unknown.
- Public mainnet RPC rate-limits `getTokenLargestAccounts`. Retries are on. The scored run above used Helius, and holder percent came back on the snapshot.
- `data/devnet-keypair.json` still has 0 SOL. The memos above used a different signer supplied in `.env`. `npm run demo:devnet` uses that file unless `SOLANA_KEYPAIR` is set.
- The manual-check, verify, and Blink limits (the `/trade` page shares the Blink count for new checks) are in memory, per process, keyed by Railway `X-Real-IP` (the edge overwrites it). A wallet on the form does not skip them. The map keeps at most 5,000 keys.
- A chain memo verifies only if the Lens proof wallet signed it (`PROOF_SIGNER`, or the configured proof keypair). Mock memos still verify.
- Checkout does not rebind an existing handle or wallet. One signature pays one checkout. Early renewal extends from the current end date.
- `/account` without a signed wallet message returns only whether the handle is Pro. Watch add and remove both need that signature and an active Pro plan.
- The home record counts replies and outbound posts. Blink and web-form checks stay on their report URLs.
- Token-2022 permanent delegate, a transfer fee of 5% or more, and accounts that start frozen are danger. A transfer hook, a smaller fee, or non-transferable is caution. An account that is not owned by the SPL Token or Token-2022 program is not scored as a mint. Top 10 holders skip known AMM and pump.fun accounts. Unread mint or freeze authority is at least MEDIUM. A burn claim with no on-chain burn is “could not be verified.”
- The worker runs one poll at a time and will not reply again when a posted reply id is already stored. `LENS_ROLE=all` exits the container if that worker process dies.
- Two workers can still double-post. Run one worker.
- Sharpe is mean divided by sample standard deviation of call returns. It is not annualized.
- Replies aim for 280 characters. The policy cap is 500. Default X copy has no URL. Set `X_REPLY_LINKS=true` to include the report link again. With links off, “Full report on …” is added only when `PUBLIC_SITE_NAME` is set or `PUBLIC_BASE_URL` is a public host. A dotted name can still be read as a link by X, so prefer a name without a domain until you want that.
- `X_SWAP_LINKS_ON_REQUEST` defaults to true. Set it to `false` to keep trade mentions link-free. When it is on, `@justasklens buy $BONK`, `swap <mint>`, or `trade $JUP` adds exactly one `Swap:` line pointing at `https://<PUBLIC_BASE_URL>/trade/<mint>` for LOW and MEDIUM. HIGH has no buy link. Copycats and other unscored tickers ask for the contract and get no link. Questions such as “should I buy?” and “safe to buy?” do not count. The link is omitted, and the reason is logged, when `PUBLIC_BASE_URL` is missing, http, localhost, `127.0.0.1`, another raw IP, or `*.local`. The reply still counts toward `RATE_LIMIT_PER_USER_PER_DAY` and `MAX_X_REPLIES_PER_DAY`. That URL is the `/trade/<mint>` page: risk level, up to three facts, and a “Buy on Jupiter” button (`jup.ag/swap?sell=<SOL>&buy=<mint>`, new tab) for LOW and MEDIUM; HIGH shows a warning and no buy link. `actions.json` maps `/trade/*` to the Action API, so Blink clients still unfurl it. Replies cached with the older `/api/actions/trade/` link are rewritten on the next trade ask.
- X unfurls a Blink in the feed only after Dialect’s Actions Registry approves the host. Apply at `https://dial.to/register`. Until then the swap URL is an ordinary link. Dialect’s dial.to interstitial still renders the action, and the Solana Actions docs’ Blinks Inspector shows the GET and POST payloads. The shared URL is the Action path itself (`/api/actions/trade/<mint>`), which `actions.json` maps to itself.
- Unknown facts (including “Creator sells could not be verified.”) stay on the report and are left out of the X reply. They are not danger. The line “Several checks could not be verified.” stays when missing data blocked a LOW.
- A `$ticker` is not a guess. Jupiter must list exactly one verified token for that symbol. Copycats, ambiguous symbols, non-Solana majors, `$SOL`, `$USDC`, and `$USDT` get a short notice instead of a risk level. A pasted mint is still scored as that mint, including a copycat or a stablecoin.
- `MAX_X_REPLIES_PER_DAY` defaults to 50. After that the worker stops replying until the next UTC day. Pro does not bypass it.
- `npm run doctor` is the pre-live checklist. It does not post. `--x` adds one `users/me` read and does not refresh tokens.
- Known stake-pool mints (JitoSOL, mSOL, bSOL, jupSOL, INF) note “stake-pool token” instead of treating an enabled mint authority as danger.
- Mention polling defaults to every 180 seconds (`POLL_INTERVAL_MS`).
- Discovery posts a token only when the rules say HIGH or LOW. A DexScreener outage logs and posts nothing new.
- Live X replies were sent on 2026-10-07 as @justasklens. Warning DMs and link-code DM reads have still not been run against a real user. Reading DMs needs the app permission “Read and write and Direct message” and an X plan with credits. A failed DM is stored as `failed` and is not retried forever. The September @perma_10 mention read returned HTTP 402 before the account had credits.
- OAuth 2.0 access tokens expire after two hours. One real refresh succeeded and the rotated tokens are stored locally, not in git. `npm run x:oauth2-login` mints a new pair when that refresh token is lost.
- Lens does not hold user funds. The USDC payment goes to `PRO_TREASURY_WALLET`. The Blink asks the user’s wallet to sign a Jupiter swap.
- An unpaid Pro checkout older than `PRO_CHECKOUT_TTL_HOURS` (default 24) is reported as expired. A transfer with the right reference and a short USDC amount is reported as the wrong amount and does not start Pro. A full transfer still confirms after the window.
- Postgres uses the same models as SQLite, generated at process start. It is not a second hand-edited schema.

## Deploy

`Dockerfile`, `docker-compose.yml`, and `fly.toml` are in the repo. Steps for Railway, Fly, and Render are in `DEPLOY.md`. Keys are in `docs/KEYS.md`.

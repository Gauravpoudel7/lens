# Status

Updated after a live mainnet scoring run, real devnet memos, and a read-only X OAuth 2.0 check. “Done” means the path works without a paid key, or the live path was executed and the result is written here. Mock mode stays labeled. Secrets stay in `.env` and are not copied here.

X replies, outbound posts, and warning DMs are link-free unless `X_REPLY_LINKS=true`. They end with “Full report on our scorecard.” instead of a report URL, because a URL on X Pay Per Use costs much more than a post without one. The worker poll defaults to 180 seconds. Jupiter defaults to `https://api.jup.ag` (same `/swap/v1` and `/price/v3` paths; `JUPITER_API_KEY` is optional). `X_BOT_USER_ID` is read from the environment or from a saved cursor; `/2/users/me` runs once per process only when both are empty.

## PRD features

| # | Feature | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Token calls | Must | Done | `publishOutbound` proves, then posts. LOW is a call. The worker runs `runOutboundCycle` when `OUTBOUND_ENABLED=true`. `OUTBOUND_DISCOVER=true` adds DexScreener profiles and boosts. Daily cap is `OUTBOUND_DAILY_CAP` (default 8). MEDIUM discoveries are not posted. |
| 2 | Warnings | Must | Done | HIGH outbound posts are kind `warning`. The same proved reply is what gets posted. |
| 3 | @askLens replies | Must | Read path live, posting not done | Poll, dedupe, free daily cap, Pro bypass, prove, then reply. `GET /2/users/me` succeeded for @perma_10. Mention reads returned HTTP 402 credits depleted. No reply, post, or DM was sent. |
| 4 | On-chain proof | Must | Done on devnet | Mock is still the default for `npm run demo`. Five live checks below each have a confirmed devnet memo. `POST /api/verify` matched the Bonk reply to its memo. |
| 5 | Public scorecard | Must | Done | Home, report, win rate, label accuracy, Sharpe after two scored calls. |
| 6 | Trade button (Blink) | Should | Done | HIGH has no buy. Jupiter runs only when `DATA_MODE=live`. |
| 7 | Pro alerts | Could | Done, payment live path untested with a real USDC transfer | Accounts by X handle and/or wallet, watchlist, DM on HIGH through `XClient.sendDm` (mock in tests). USDC Solana Pay reference transfer, verified from token balance changes. Card rail exists and refuses checkout. |

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
| 1. Resolver | Done | Real parser. Symbol lookup follows `DATA_MODE`. |
| 2. Risk engine | Done | Deterministic. Live fields from DexScreener, Solana RPC, RugCheck, optional Birdeye, Jupiter price. |
| 3. Reply writer | Done | Template unless an LLM key is set and `LLM_MODE` is not `template`. Posted text has no URL unless `X_REPLY_LINKS=true`. |
| 4. Proof | Done | Five devnet memos in the section above. `npm run demo` stays mock. |
| 5. X bot | User read works | `users/me` and token refresh succeeded. The worker now caches that user id. Mentions need X API credits. Nothing was posted. |
| 6. Database and outcome job | Done | SQLite by default. Postgres when `DATABASE_URL` starts with `postgres`. |
| 7. Scorecard, report, check form, HTTP API | Done | Port 3847. `/pro` creates a Solana Pay link when `PRO_TREASURY_WALLET` is set. |
| 8. Blink | Done | Jupiter buy path needs `DATA_MODE=live`. |
| 9. Pro | Done in tests | Chain verifier is real code. No USDC was sent from this environment. |
| 10. Scheduled outbound | Done in tests | Worker calls it each poll. Off unless `OUTBOUND_ENABLED=true`. |

## Mocked vs real

| Concern | Mock default | Live when configured |
| --- | --- | --- |
| Token facts | Fixtures `$DANGER`, `$SAFE`, `$MID`, plus synthetic mints | DexScreener, mainnet RPC, RugCheck, optional Birdeye, Jupiter |
| Reply text | Template | Template, or LLM if a key is set |
| Proof | `mock_` signature in `ChainMemo` | Memo on `SOLANA_CLUSTER` |
| X posts and DMs | `MockXClient` | `twitter-api-v2` with OAuth 1.0a, or OAuth 2.0 user context. Refresh tokens are saved in `XOAuth2Token` and `data/x-oauth2.json`. DMs need DM permission on the app |
| Pro payment | Tests inject a fake chain | `getTransaction` on `PRO_RPC_URL` for a USDC balance increase |
| Jupiter swap | Error string, no fake transaction | `https://api.jup.ag` `/swap/v1`. Optional `x-api-key` |
| Card checkout | `createCardRail` throws | Not built |

The scorecard banner stays up while data or proof mode is mock.

## Known limits

- Token age is the earliest pool time DexScreener returned, or RugCheck `detectedAt`, whichever is older. It is not the mint’s first slot.
- Creator sold percent is only filled when Birdeye returns it. Unknown sells are not danger.
- Sniper percent is RugCheck’s insider-network holding, or a Birdeye field when present.
- LP lock is a heuristic. Concentrated-liquidity pools stay unknown.
- Public mainnet RPC rate-limits `getTokenLargestAccounts`. Retries are on. The scored run above used Helius, and holder percent came back on the snapshot.
- `data/devnet-keypair.json` still has 0 SOL. The memos above used a different signer supplied in `.env`. `npm run demo:devnet` uses that file unless `SOLANA_KEYPAIR` is set.
- The manual-check IP limit is in memory, per process. A Pro wallet on the form skips it. That wallet is not a login.
- Two workers can double-post. Run one worker.
- Sharpe is mean divided by sample standard deviation of call returns. It is not annualized.
- Replies aim for 280 characters. The policy cap is 500. Default X copy has no URL. Set `X_REPLY_LINKS=true` to include the report link again.
- `MAX_X_REPLIES_PER_DAY` defaults to 50. After that the worker stops replying until the next UTC day. Pro does not bypass it.
- `npm run doctor` is the pre-live checklist. It does not post. `--x` adds one `users/me` read and does not refresh tokens.
- Known stake-pool mints (JitoSOL, mSOL, bSOL, jupSOL, INF) note “stake-pool token” instead of treating an enabled mint authority as danger.
- Mention polling defaults to every 180 seconds (`POLL_INTERVAL_MS`).
- Discovery posts a token only when the rules say HIGH or LOW. A DexScreener outage logs and posts nothing new.
- Live X posts and DMs were not sent. Mention reads and app-only reads return HTTP 402 until the X app has credits. A failed DM is stored as `failed` and is not retried forever.
- OAuth 2.0 access tokens expire after two hours. One real refresh succeeded and the rotated tokens are stored locally, not in git. `npm run x:oauth2-login` mints a new pair when that refresh token is lost.
- Lens does not hold user funds. The USDC payment goes to `PRO_TREASURY_WALLET`. The Blink asks the user’s wallet to sign a Jupiter swap.
- Postgres uses the same models as SQLite, generated at process start. It is not a second hand-edited schema.

## Deploy

`Dockerfile`, `docker-compose.yml`, and `fly.toml` are in the repo. Steps for Railway, Fly, and Render are in `DEPLOY.md`. Keys are in `docs/KEYS.md`.

# Status

Updated after Pro, discovery, deploy packaging, and a live mainnet read. “Done” means the path works without a paid key, or the live path was executed and the result is written here. Mock mode stays labeled.

## PRD features

| # | Feature | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Token calls | Must | Done | `publishOutbound` proves, then posts. LOW is a call. The worker runs `runOutboundCycle` when `OUTBOUND_ENABLED=true`. `OUTBOUND_DISCOVER=true` adds DexScreener profiles and boosts. Daily cap is `OUTBOUND_DAILY_CAP` (default 8). MEDIUM discoveries are not posted. |
| 2 | Warnings | Must | Done | HIGH outbound posts are kind `warning`. The same proved reply is what gets posted. |
| 3 | @askLens replies | Must | Done in mock, live untested | Poll, dedupe, free daily cap, Pro bypass, prove, then reply. Live X client is in `apps/worker/src/x-live.ts`. It has not been run against the paid API here. |
| 4 | On-chain proof | Must | Done | Mock is still the default for `npm run demo`. `PROOF_MODE=solana` sends a memo. A real devnet signature is in the section below. |
| 5 | Public scorecard | Must | Done | Home, report, win rate, label accuracy, Sharpe after two scored calls. |
| 6 | Trade button (Blink) | Should | Done | HIGH has no buy. Jupiter runs only when `DATA_MODE=live`. |
| 7 | Pro alerts | Could | Done, payment live path untested with a real USDC transfer | Accounts by X handle and/or wallet, watchlist, DM on HIGH through `XClient.sendDm` (mock in tests). USDC Solana Pay reference transfer, verified from token balance changes. Card rail exists and refuses checkout. |

## Devnet memo

Keypair pubkey: `3qtAA6DHz3ufStouNS92k7sCehiuB89S3rzGWb1ZVAC2`

File: `data/devnet-keypair.json` (gitignored, not committed).

`npm run setup:devnet` created that file and called `requestAirdrop` on `https://api.devnet.solana.com`. The faucet returned HTTP 429: airdrop limit reached or the faucet is dry for this network. `https://rpc.ankr.com/solana_devnet` did not return a usable balance. The signature line below is filled only after a confirmed memo.

SIGNATURE_PENDING

## Live mainnet reads

`npm run live:sample` on 2026-09-29, public mainnet RPC, no Helius key.

| Token | Mint | What came back |
| --- | --- | --- |
| Bonk | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` | Created 2022-12-20. Price about $0.000003714. Liquidity about $421,911. LP lock unknown. Top 10 about 38.7%. Mint and freeze off. Sniper about 0.09%. Burned 0%. Sources: DexScreener, Solana RPC, RugCheck. |
| PUMPKIN HEAD (pump.fun) | `5U2xu35J4LmURGsxCPZi1ZWSBRkKExcNKkmv5Zr8pump` | Created 2026-09-21. Price about $0.00001331. Liquidity about $6,905. LP lock unknown. Top 10 about 84.3%. Mint and freeze off. Sniper 0%. Burned 0%. Sources: DexScreener, Solana RPC, RugCheck. |

`getTokenLargestAccounts` still returned HTTP 429 after 4 attempts. The mint account read succeeded, so mint and freeze authority stayed on the snapshot (`solana-rpc` is in `sources`). Holder percent and burn fell through to RugCheck instead of dropping the whole chain read. Set `HELIUS_API_KEY` before you trust holder math from RPC alone.

## Loop checklist

| Step | Status | Real or mocked |
| --- | --- | --- |
| 1. Resolver | Done | Real parser. Symbol lookup follows `DATA_MODE`. |
| 2. Risk engine | Done | Deterministic. Live fields from DexScreener, Solana RPC, RugCheck, optional Birdeye, Jupiter price. |
| 3. Reply writer | Done | Template unless an LLM key is set and `LLM_MODE` is not `template`. |
| 4. Proof | Done | Mock by default. Solana memo path is the devnet section above. |
| 5. X bot | Done in mock | Live client implemented, including DMs. Not exercised against X. |
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
| X posts and DMs | `MockXClient` | `twitter-api-v2` user context. DMs need DM permission on the app |
| Pro payment | Tests inject a fake chain | `getTransaction` on `PRO_RPC_URL` for a USDC balance increase |
| Jupiter swap | Error string, no fake transaction | Lite swap API |
| Card checkout | `createCardRail` throws | Not built |

The scorecard banner stays up while data or proof mode is mock.

## Known limits

- Token age is the earliest pool time DexScreener returned, or RugCheck `detectedAt`, whichever is older. It is not the mint’s first slot.
- Creator sold percent is only filled when Birdeye returns it. Unknown sells are not danger.
- Sniper percent is RugCheck’s insider-network holding, or a Birdeye field when present.
- LP lock is a heuristic. Concentrated-liquidity pools stay unknown.
- Public mainnet RPC rate-limits `getTokenLargestAccounts`. Retries are on. Helius is still the right fix for holder lists.
- The manual-check IP limit is in memory, per process. A Pro wallet on the form skips it. That wallet is not a login.
- Two workers can double-post. Run one worker.
- Sharpe is mean divided by sample standard deviation of call returns. It is not annualized.
- Replies aim for 280 characters. The policy cap is 500.
- Discovery posts a token only when the rules say HIGH or LOW. A DexScreener outage logs and posts nothing new.
- Live X DMs were not sent from this environment. A failed DM is stored as `failed` and is not retried forever.
- Lens does not hold user funds. The USDC payment goes to `PRO_TREASURY_WALLET`. The Blink asks the user’s wallet to sign a Jupiter swap.
- Postgres uses the same models as SQLite, generated at process start. It is not a second hand-edited schema.

## Deploy

`Dockerfile`, `docker-compose.yml`, and `fly.toml` are in the repo. Steps for Railway, Fly, and Render are in `DEPLOY.md`. Keys are in `docs/KEYS.md`.

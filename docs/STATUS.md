# Status

Updated for the MVP in this repo. “Done” means the path works in mock mode and the live path is implemented behind the same interface. It does not mean a production key has been used from this environment.

## PRD features

| # | Feature | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Token calls | Must | Partial | `npm run post -- --mint <address>` and `publishOutbound` run the same prove-then-post path. HIGH is stored as a warning, LOW as a call. `OUTBOUND_ENABLED` plus `OUTBOUND_MINTS` posts each mint about once per 20 hours from the worker. There is no discovery engine that picks tokens by itself. |
| 2 | Warnings | Must | Partial | Same outbound path. A HIGH result is kind `warning`. The copy is the risk reply, not a separate accusation. |
| 3 | @askLens replies | Must | Done in mock, live untested | Poll, dedupe by parent post + mint, per-user daily cap, prove, then reply. Live X client is in `apps/worker/src/x-live.ts`. It has not been run against the paid API here. |
| 4 | On-chain proof | Must | Done | Hash + timestamp memo. Mock cluster is the default and is what `npm run demo` uses. `PROOF_MODE=solana` sends a real memo to devnet or mainnet when a keypair is set. Verify endpoint compares text to the memo. |
| 5 | Public scorecard | Must | Done | Home page, per-check report, win rate, HIGH-drop rate, LOW-held rate, label accuracy, Sharpe after two scored calls. Explorer link when the cluster is not mock. |
| 6 | Trade button (Blink) | Should | Done | `GET/POST /api/actions/trade/:mint`. HIGH shows a warning and POST returns 403. Other levels build a Jupiter swap only when `DATA_MODE=live`. Mock mode returns an error instead of a fake transaction. |
| 7 | Pro alerts | Could | Not started | No accounts, payments, or DMs. |

## Loop checklist

| Step | Status | Real or mocked |
| --- | --- | --- |
| 1. Resolver | Done | Real parser. Symbol lookup is mock or DexScreener depending on `DATA_MODE`. |
| 2. Risk engine | Done | Deterministic. Tests cover the thresholds. Live snapshot fields come from DexScreener, Solana RPC, RugCheck, optional Birdeye, Jupiter price. |
| 3. Reply writer | Done | Template by default. LLM only if a key is set and `LLM_MODE` is not `template`. Policy strips “scam” and rejects a changed risk level. |
| 4. Proof | Done | Mock in demo. Solana memo code is real and unused until a keypair and `PROOF_MODE=solana`. |
| 5. X bot | Done in mock | Interface + dry-run mock. Live client implemented, not exercised. |
| 6. Database and outcome job | Done | SQLite. Demo scores with window 0 and fixture prices. Default window is 7 days. |
| 7. Scorecard, report, check form, HTTP API | Done | Next.js on port 3847. |
| 8. Blink | Done | Warning path is fully local. Jupiter buy path needs `DATA_MODE=live` and a wallet. |

## Mocked vs real

| Concern | Mock default | Live when configured |
| --- | --- | --- |
| Token facts | Fixtures `$DANGER`, `$SAFE`, `$MID`. Any other mint is a synthetic profile hashed from the address. | DexScreener, mainnet RPC, RugCheck, optional Birdeye, Jupiter price. |
| Reply text | Template | Template, or LLM if `LLM_API_KEY` / `OPENAI_API_KEY` is set |
| Proof | Row in `ChainMemo`, signature prefix `mock_` | Memo transaction on `SOLANA_CLUSTER` |
| X | In-memory client. Demo seeds one parent post. | `twitter-api-v2` user context |
| Jupiter swap | POST returns an error explaining mock mode | Lite swap API returns a signable transaction |
| Outcome prices in the demo | `priceAfterWindow` on the fixture | `getPrice` from Jupiter, then DexScreener |

The scorecard banner stays up while either data or proof mode is mock.

## Known limits

- Token age is the earliest pool timestamp DexScreener returned, or RugCheck’s `detectedAt`, whichever is older. It is not the mint’s first slot. A new pool on an old mint can still look old if any earlier pool is in the response. If the API only returns new pools, an old mint can look younger than it is.
- “Creator sold N%” is filled only when Birdeye returns `creatorSoldPercent` or `creatorSoldPct`. Otherwise the fact says sells could not be verified, and that unknown does not count as danger. Current creator balance alone is not treated as selling.
- Sniper percent is RugCheck’s insider-network holding, or a Birdeye sniper field when present. It is a proxy for coordinated early wallets, not a reconstructed first-block buyer list.
- LP lock is a heuristic over RugCheck markets and lockers. Concentrated-liquidity pools are “unknown”, not “unlocked”.
- Public mainnet RPC will rate-limit. Set `HELIUS_API_KEY` or `DATA_RPC_URL` for anything beyond a demo.
- The manual-check rate limit is in memory, per process, not shared across servers.
- Two workers could prove the same post twice. The poller is single-threaded and does not take a lock.
- Sharpe is mean divided by sample standard deviation of call returns over the scoring window. It is not annualized.
- A standard X account can reject replies over 280 characters. The template aims for 280. The policy cap is 500.
- Mock proofs do not appear on an explorer. The report explains that.
- Synthetic mock mints must not be read as mainnet research. The report says “mock fixtures”.
- Pro alerts, payments, and USDC billing are not built.
- Lens does not hold user funds. The Blink asks the user’s wallet to sign a Jupiter swap. The fee account is optional and off until `JUPITER_FEE_ACCOUNT` is set.
- `PROOF_MODE=solana` was not executed in this environment (no funded devnet key in the repo). The transaction builder is covered by code review and unit tests of the memo bytes, not by a live signature.

## Next steps

1. Generate a devnet keypair, fund it, set `PROOF_MODE=solana`, and confirm one memo on `explorer.solana.com` with `?cluster=devnet`.
2. Set `DATA_MODE=live` and `HELIUS_API_KEY`, then run `npm run post -- --mint <real mint>` for a known token and read the report against Solscan.
3. Add Birdeye and check that creator-sold facts appear for a mint where that field exists.
4. Put X user-context keys in `.env`, set `X_MODE=live`, and run `npm run worker:once` against a test mention.
5. Add an LLM key only after the template replies look right. The level must still come from the rules.
6. Decide a real source for “a few calls a day” before turning `OUTBOUND_ENABLED` on with a watchlist. Do not invent tokens.
7. Pro alerts: accounts, a payment rail, and DM delivery. Not started on purpose.
8. Move the store to Postgres when more than one host needs the same record. Keep the `LensStore` interface.

# Plan: make Lens post, with X's live coin card

Status: proposal, not built. For the agent working in this repo. Read `AGENTS.md`, `docs/STATUS.md` and `docs/ARCHITECTURE.md` first. Every rule in `AGENTS.md` still applies: risk level only from `risk/engine.ts`, proof before posting, hash the exact posted text, no word "scam", no buy or sell advice, mock data labeled, tests next to the code.

Parts:

1. **Get posting live.** Outbound coin posts and editorial posts are built but off, and `npm run post` only posts to the mock client.
2. **Show the live coin card** that X draws itself for linked cashtags (see Part 2).
3. **No drawn or made-up images.** If posts sent through the API cannot get X's live card, coin posts go out as text only. Lens never draws its own chart.

The card in `docs/assets/coin-card-reference.png` is not an image someone uploaded. It is X's own Cashtags feature (launched April 2026): when a post's `$TICKER` is linked to a specific asset, X shows a live price card with a chart. A search for that card shows `$ANSEM OR solana:9cRCn9…pump`, so X links the cashtag to the exact Solana contract.

---

## Part 1: get posting live

### 1.1 Settings (no code)

In `.env` on the machine that runs the worker (or the host's variables):

```
X_MODE=live
DATA_MODE=live
PROOF_MODE=solana
SOLANA_CLUSTER=devnet
OUTBOUND_ENABLED=true
OUTBOUND_DISCOVER=true
OUTBOUND_DAILY_CAP=8
EDITORIAL_ENABLED=true
EDITORIAL_KINDS=tip
```

Start with `EDITORIAL_KINDS=tip` for two days, then `tip,term,recap`. Optionally seed `OUTBOUND_MINTS` with one known LOW mint (BONK `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`) so the first poll has something to post.

Then `npm run doctor`, then `npm run worker`. Only one worker may run at a time (laptop or host, not both).

Things that silently stop posts, and what to check:

| Symptom | Cause |
| --- | --- |
| `proof failed` in logs | Proof wallet has no devnet SOL. No proof, no post, by design. |
| HTTP 402 `credits depleted` | X developer account needs credit. |
| No errors, no coin posts | Discovery posts only LOW or HIGH. Seed `OUTBOUND_MINTS`. |
| No editorial post | Current UTC hour is before the slot, or more than `EDITORIAL_MAX_LATE_HOURS` after it. `npm run doctor` lists the slots. |

### 1.2 Fix `npm run post`

`scripts/post.ts` builds the runtime with `createRuntime()`, which always uses `MockXClient`. Only the worker swaps in the live client (`apps/worker/src/index.ts`). So `npm run post -- --mint <mint>` proves and saves but never reaches X, even with `X_MODE=live`.

Change:

- Move `createLiveXClient` out of `apps/worker/src/x-live.ts` into a place both the worker and scripts can import (for example `packages/db/src/x-live.ts`, since it needs the store for OAuth 2.0 token rotation). Keep the rule from `AGENTS.md`: X API code lives in one module; the web app stays on the mock client.
- In `scripts/post.ts`, when `config.xMode === "live"`, set `rt.x = await createLiveXClient(rt.store)` before `publishOutbound`.
- Add `--dry-run` to `scripts/post.ts`: build the text without proving or posting.
- Print which X client was used, so nobody mistakes a mock post for a real one.

Acceptance: with `X_MODE=live`, `npm run post -- --mint <BONK>` creates a real post on @justasklens, with the proof first. With `X_MODE=mock` it says it used the mock client.

---

## Part 2: X's live cashtag card

Goal: every outbound coin post shows X's live price card for the right coin, with no image of our own.

What is known (October 2026, from news coverage, not X developer docs):

- In the app, a poster can pick the exact asset for a cashtag, or paste a contract address and X suggests the match.
- X says the data behind it covers anything minted on-chain, including tokens not on big exchanges.
- Launch was on iPhone in the US and Canada; other platforms and regions may not show the card yet.
- No public API documentation was found for linking a cashtag to an asset in a post sent through the API.

### Step 1: find out what works through the API (manual test, about 30 minutes)

Use `npm run post` after the Part 1.2 fix, or a one-off script with the live X client. Post each of these from @justasklens, a few minutes apart, and look at each post on X (iPhone app and web):

| Test | Post text |
| --- | --- |
| A | Cashtag only: `$BONK test` |
| B | Cashtag and full mint: `$BONK DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` |
| C | Full mint only: `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` |

Also read the created post back with `GET /2/tweets/:id?tweet.fields=entities` and record what X put in `entities.cashtags` (any asset or contract field). Delete the test posts afterwards. Write the results in `docs/STATUS.md`.

Also check the current X API docs for anything about cashtag assets, financial entities, or a `solana:<mint>` form, and record what you find.

### Step 2: build only what the test proved

- **If test B (or A) shows the right card:** change the outbound post template in `packages/core/src/reply/policy.ts` so coin posts include the `$SYMBOL` cashtag and, if B was needed, the full mint instead of the short one. A full mint is not a URL, so the post stays at the no-link price. Keep the text within 280 weighted characters (`reply/length.ts`); drop a fact line before dropping the mint. Add a test that the outbound text contains the cashtag and full mint and still fits.
- **Only for coins that are scored as that exact mint.** Unscored tickers and copycats keep their current notice. A HIGH warning still says HIGH in the text: the live card shows price, not risk, so the words carry the risk.
- **If the card links to the wrong coin** (for example a copycat with the same symbol), use the full-mint form, or leave the cashtag out for that coin. A live card for the wrong coin is worse than none.
- **If nothing shows a card through the API:** keep coin posts text only. Do not render or upload a chart image of our own. Record the result in `docs/STATUS.md` and check again when X publishes API docs for Cashtags.

Do not change the proof: the memo still hashes the exact posted text, cashtag and mint included.


## Order of work

| Step | Work | Time |
| --- | --- | --- |
| 1 | Part 1.1 settings, run the worker, confirm a coin post and a tip on X | 30 minutes |
| 2 | Part 1.2 fix `npm run post` | 1 hour |
| 3 | Part 2 step 1: the three test posts, record the result | 30 minutes |
| 4 | Part 2 step 2: cashtag + full mint in coin posts, tests | 1–2 hours |

## Done when

- @justasklens posts coin calls or warnings and a daily tip without anyone running a command.
- If the Part 2 test passed, a coin post shows X's live price card for the right coin. If it did not, coin posts are text only, with no image of our own.
- The post text still says the risk level in words, and the proof hashes the exact posted text.
- `npm test` and `npm run typecheck` pass, and `docs/STATUS.md` says what actually shipped, including the Part 2 test results.

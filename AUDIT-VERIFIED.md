# Audit: Lens Verified (uncommitted work)

Date: 2026-10-11. Scope: the uncommitted working tree on `main` (25 modified files plus the new `verified.ts`, `verified.test.ts`, `apps/web/app/(app)/verified/`, `apps/web/app/api/verified/`). I did not rely on the earlier summary. Every claim below comes from reading the code or running it. No source code was changed during this audit.

## Verdict: **ship**, after the fixes below (first verdict was **fix first**)

The first pass found two failures. Both were fixed or resolved the same day; see "Fixes applied" at the end. The rows below give the original result, with the current state in brackets. Nothing found lets anyone buy a rating, and tests, typecheck and the production build are green.

| # | Area | Result |
|---|------|--------|
| 1 | Rating cannot be bought | PASS |
| 2 | Payments | PASS (2 notes) |
| 3 | Creator-only buy and edit | **FAIL** (buy side). Edit side PASS. [Fixed] |
| 4 | Badge | PASS |
| 5 | X command | **FAIL** (link policy). Everything else PASS. [Resolved: documented as an exception] |
| 6 | Pages | PASS |
| 7 | Regressions and migration | PASS |
| 8 | Secrets | PASS (1 info). [Fixed] |

## How it was checked

- `npm test`: 47 files, 277 tests passed.
- `npm run typecheck`: exit 0 for core, db, worker and web.
- `NEXT_DIST_DIR=.next-audit npm run build`: exit 0, and `/verified` plus `/verified/[mint]` were built. The build went to a separate folder so the running dev server on 3847 was not touched. The folder was deleted afterwards.
- `prisma migrate diff` from the HEAD schema to the working schema, for both SQLite and Postgres.
- A separate production server on port 3999 with a scratch SQLite DB in mock mode (`DATA_MODE`, `PROOF_MODE` and `X_MODE` all `mock`). The user's `data/lens.db` and the live-mode dev server were not used. `npm run demo` was run against the scratch DB. A scratch script then bought a listing for HIGH `$DANGER` through the real checkout and confirm code.
- A temporary Vitest file with 20 extra audit cases, all passing, then deleted. These cases are cited below as "audit test".

## 1. Rating cannot be bought: PASS

- `git diff --quiet HEAD -- packages/core/src/risk/` succeeds. `engine.ts`, `thresholds.ts` and `stake-pools.ts` are byte-identical to HEAD. There are no untracked files in `risk/`.
- Trace from payment to rating:
  1. `confirmUsdcCheckout` (`billing/service.ts:181-193`) writes only `VerifiedListing.paidUntil` and the owner.
  2. The listing is read once, in `pipeline.ts:328`. That is after `evaluateRisk` at `pipeline.ts:303`, and the listing is passed only to the reply writer as `verified`.
  3. `enforceReplyPolicy` refuses any text whose level differs from the engine's (`reply/policy.ts:196,208`).
  4. The web pages take the level only from a stored check (`verifiedView`, `verified.ts:60-70`, `[mint]/page.tsx:57-58`).
- Team links are stored on `VerifiedListing` only. No call site passes them to `snapshotToRuleInput` or `evaluateRisk`.
- Runtime: `/verified/<DANGER>` with an active paid listing shows "Live rating by Lens rules HIGH" and no "Checked by Lens". `/verified` lists `$DANGER … HIGH` with no badge. This is also covered by `verified.test.ts:224`.

## 2. Payments: PASS, with notes

- **Exact amount, right token, right recipient.** `paymentSatisfied` (`billing/solana-pay.ts:66-74`) requires the reference among the account keys, and a balance increase of at least `amountRaw` for `recipient` + `mint`. The amount is set per checkout from `VERIFIED_PRICE_USDC` (`verified.ts:41-47`, `service.ts:69-104`). Audit tests confirm that 49.99 USDC, a non-USDC mint, and a different recipient are each rejected, and no listing is created.
- **Reused signature.** `service.ts:176-179` rejects it. An audit test shows one transaction carrying both a Pro reference and a Verified reference: after it confirmed Pro, it was refused for Verified (`reused_signature`).
- **Expired checkout.** An unpaid checkout older than `PRO_CHECKOUT_TTL_HOURS` returns `expired` (`service.ts:212-214`, audit test).
- **Verified and Pro stay separate.** The Verified branch never calls `setProUntil` (`service.ts:181-194`). The Pro branch never touches listings. An audit test checks `proUntil` stays empty after a Verified payment, and `verified.test.ts:99,118,129` cover the rest.
- **Expiry.** `paidUntil = from + verifiedPeriodDays * 86_400_000` (`service.ts:191`). An audit test shows the listing active at +29 days and inactive just after +30 days.
- Note A, by design and already true for Pro: a full transfer that arrives after the checkout's TTL still confirms. This is documented in `.env.example` and in the README row for `PRO_CHECKOUT_TTL_HOURS`. Refusing it would keep money without giving the service.
- Note B, a race not proven by a test: `Payment.signature` has no unique constraint (`prisma/schema.prisma:178`). The reuse check reads and then writes, so two confirms at the same moment for different references in one transaction could both pass. This was already true for Pro. Verified now gives the race a second thing to buy.

## 3. Creator-only: FAIL on the buy side

**FAIL: anyone can buy a coin's Verified page.**
- `apps/web/app/api/verified/checkout/route.ts:16-18` takes `wallet` from the JSON body and asks for no wallet signature or session.
- `startVerifiedCheckout` (`verified.ts:38`) only compares that typed string with `snapshot.creatorWallet`. The creator address is public.
- Runtime, on the audit server: `POST /api/verified/checkout {"wallet":"<SAFE creator>","mint":"<SAFE>"}` with no cookie returned `200` and a payment reference.
- The QR/link path in `pro-panel.tsx` lets any wallet pay that reference. The `wrong_wallet` check in `checkout-tx.ts:146` covers only the in-browser Phantom path, and it trusts a client-supplied `account`.
- Effect: a third party can turn on a coin's Verified page and list it on `/verified` without the team's consent. The listing owner is still the creator wallet (`service.ts:189`), so editing stays creator-only.

What passes:
- Missing creator is rejected (`verified.ts:35-37`, `verified.test.ts:78`).
- An impersonator wallet is rejected: "Pay from the wallet that created this token." (scratch script, `verified.test.ts:69`).
- **Edit API**, `apps/web/app/api/verified/[mint]/route.ts`:
  - Other origin returns 403 (`:10`, via `sameOrigin`, `apps/web/lib/wallet-session.ts:71-79`). Runtime: `Origin: https://evil.example` gave 403.
  - No sign-in returns 401 (`:13-16`). Runtime: 401.
  - A forged cookie (`lens_session=forged.abc`) returns 401. The session is an HMAC-signed cookie made only after a single-use nonce signature (`wallet-session.ts:26-31,45-49`).
  - A wallet other than the owner gets 403 (`:22-24`).
  - A bad mint gets 400.
- **Link cleaning**, `cleanTeamInfo` (`verified.ts:73-98`). Audit tests reject:
  - `javascript:`, `data:` and `http:` links
  - `https://user:pw@…`
  - `https://localhost` (no dot in the host name)
  - links over 200 characters
  - bare `<script>` and non-string values

  A link such as `https://ok.com/"><script>…` is stored percent-encoded, with no `<`, `>` or `"`.
- **More than five links cannot be stored.** There are exactly five fixed fields, and a sixth key is ignored rather than rejected with 400.
- **No HTML injection.** Links are rendered through React `href` and text with `rel="nofollow ugc noopener noreferrer"` (`[mint]/page.tsx:117-124`). There is no `dangerouslySetInnerHTML`.

## 4. Badge: PASS

- `badge = active && fresh && level === "LOW"` (`verified.ts:65-69`), with `fresh` meaning age ≤ `TRADE_CHECK_MAX_AGE_MS` = 15 minutes (`trade.ts:5`).
- An expired listing makes `active` false. A stale check makes `fresh` false. MEDIUM or HIGH fails the level test. Covered by `verified.test.ts:152`.
- Runtime: SAFE shows "Checked by Lens (mock data)" with LOW. DANGER, also paid, shows no badge.

## 5. X command: FAIL on link policy

**FAIL: the Verified URL is posted even when `X_REPLY_LINKS` is off.**
- `reply/policy.ts:94-104` adds `Lens Verified page: https://…/verified/<mint>` whenever the listing is active and `PUBLIC_BASE_URL` is public https. It does not look at `includeLinks`.
- `AGENTS.md:36` and `docs/STATUS.md:5` say X replies omit URLs unless `X_REPLY_LINKS=true`. The only exception they list is the swap Blink.
- The README section added with this work documents the new URL. `AGENTS.md` and `STATUS.md` were not updated to match.
- An audit test with `X_REPLY_LINKS=false` posted the URL. `verified.test.ts:218` also expects it with default settings.

What passes:
- **The command matches.** `wantsVerifiedPage` handles `verify $TICKER` and `verify <mint>` (`verified.ts:101-105`, `verified.test.ts:182`). The reply has the normal rating and one line before the disclaimer (`policy.ts:136,221`).
- **Copycat tickers are still refused.** The resolver is unchanged. An audit test of `verify $JUP` got "Several coins use $JUP".
- **Never a swap link.** `askedToTrade = !askedVerify && …` (`pipeline.ts:131`). An audit test of `verify $SAFE buy` with `X_SWAP_LINKS_ON_REQUEST=true` got no `/trade/` link.
- **The proof matches the posted text.**
  1. The line is added inside `enforceReplyPolicy`, which produces `written.text`.
  2. `buildProofPayload(written.text)` is hashed (`pipeline.ts:351`).
  3. The reply posts `check.replyText`, which is that same string.
  4. Audit test and `verified.test.ts:219` both check `proof.contentHash === hashReply(posted)`.
- **Nothing posts if the proof fails.** `pipeline.ts:358` returns before save and post. Covered by `verified.test.ts:241`.
- **Rate limits still apply.** The per-user daily cap (`pipeline.ts:101`) and the bot cap (`pipeline.ts:111`) run before the verify branch. An audit test with a limit of 2 gave `replied, replied, rate_limited`.
- **Cache.** A verify mention skips the cached reply (`pipeline.ts:159`). A normal mention never reuses a reply that has the Verified line.
- Low-risk note: only the exact Verified line is stripped from model-written replies, so an LLM draft could still say "Lens Verified" in free text. Template mode is not affected.

## 6. Pages: PASS

- On the audit server, `/verified`, `/verified/<SAFE>` and `/verified/<DANGER>` return 200.
- **The list page never runs a check.** It calls only `listActiveVerified` and `latestCheckForMint` (`verified/page.tsx:27-31`). A coin with no check from the last 15 minutes shows "Not checked recently".
- **The coin page is rate-limited like `/trade`.** It uses `loadTradeCheck` with `clientKeyFromHeaders(…, "trade")` and `checkApiLimitPerHour` (`[mint]/page.tsx:52-54`). That is the same helper and limit as `/trade/<mint>`.
- **No buy button.** There is no Jupiter swap or trade link. The only `jup.ag` URL in the HTML is the token logo image. The only payment button is for the page itself.
- **Disclaimers are shown.** "Provided by the team" and "Lens did not check these links. They do not affect the rating." appear (`[mint]/page.tsx:107-110`). Runtime confirmed both.
- **Mock data is labeled.** Both pages show "Demo mode: token numbers are samples, and stamps are saved locally, not on Solana." The badge reads "(mock data)".

## 7. Regressions and migration: PASS

- `npm test`, `npm run typecheck` and the production build all pass (see "How it was checked").
- Runtime 200 on the audit server: `/`, `/record`, `/check`, `/verify`, `/pro`, `/trade/<SAFE>`, `/r/<id>` and `/sitemap.xml`.
- Normal mentions: the existing pipeline tests, including swap, copycat, cache and caps, pass unchanged. The template output is identical when `verified` is null, because `extra` holds only the swap line as before.
- **Postgres migration** is purely additive:
  - `ALTER TABLE "Payment" ADD COLUMN "listingMint" TEXT, ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'pro'`
  - `CREATE TABLE "VerifiedListing"`, plus a foreign key and an index
- **SQLite migration**: Prisma rebuilds `Payment` with its standard copy-and-rename, because SQLite cannot add a column with a default in place. All existing columns are copied, and nothing is dropped or changed.
- Old Pro payments read back as `purpose = "pro"`.

## 8. Secrets: PASS

- A grep of the diff and the new files found no keys, tokens or private material. The demo's fallback treasury is a public address.
- A grep of the built client bundle (`.next-audit/static`) found nothing for `HELIUS`, `BIRDEYE`, `X_CLIENT_SECRET`, `LLM_API_KEY`, `LENS_SESSION_SECRET`, `SOLANA_KEYPAIR`, `sessionSecret`, `llmApiKey`, `proTreasury` or `PRIVATE KEY`.
- No new log lines include secrets. The only new log is `${purpose} checkout refused` with a fixed detail string.
- Info: `[mint]/page.tsx:134` passes the whole listing to the client `TeamForm`, which puts the internal `userId` in the page payload. It is not a secret and no route accepts it as authority, but the form needs only the five link fields.

## Fixes proposed (not applied)

1. **Creator-only buy (FAIL 3).** In `apps/web/app/api/verified/checkout/route.ts`, require `await sessionWallet() === body.wallet` and otherwise return 401 with `reason: "signin"`. In `pro-panel.tsx`, when `listingMint` is set, call `signInWithWallet()` before starting the checkout. The same retry pattern already exists in `team-form.tsx`. This ties the reference to a wallet signature, so only the creator learns it before paying.
2. **Link policy (FAIL 5).** This is a decision. Either:
   - (a) gate the URL on `includeLinks` in `verifiedUrl` (`policy.ts:94`), so the reply says "Has a Lens Verified page." when links are off; or
   - (b) keep the URL and add it as a named exception in `AGENTS.md:36` and `docs/STATUS.md:5`.

   Option (a) is the smaller change and matches the existing rule. `verified.test.ts:218` would then need `X_REPLY_LINKS: "true"`.
3. Optional: pass only the five `TeamInfo` fields to `TeamForm`.
4. Optional, for note B: make `Payment.signature` `@unique`. This is a schema tightening, not additive, and would fail if duplicate signatures already exist, so check the data first.

## Fixes applied (2026-10-11, approved by the user)

1. **Creator-only buy.**
   - `apps/web/app/api/verified/checkout/route.ts` now requires:
     - a same-site `Origin` (403 otherwise)
     - a session cookie (401 with `reason: "signin"` otherwise)
     - a session wallet equal to `body.wallet` (403 otherwise)
   - `pro-panel.tsx` `startCheckout` asks for one wallet signature and retries when the route answers `signin`. This applies only when `listingMint` is set; the Pro checkout is unchanged.
   - Runtime check on the audit server, with session cookies signed by a scratch `LENS_SESSION_SECRET`:

     | Request | Result |
     |---------|--------|
     | No session | 401 |
     | Other wallet's session | 403 |
     | `Origin: https://evil.example` | 403 |
     | Creator's session | 200 with a reference |
2. **Link policy.** The user chose to keep the Verified URL and document it as an exception. It is now written into `AGENTS.md` (the Reply wording row), `docs/STATUS.md` (the link paragraph), and `README.md` (the `PUBLIC_BASE_URL` row). The code is unchanged.
3. **`TeamForm`** now receives only the five link fields (`[mint]/page.tsx`). Runtime: the `/verified/<SAFE>` HTML no longer contains `userId`.

After the fixes:
- `npm test` 277/277, `npm run typecheck` OK, production build OK.
- `/`, `/record`, `/check`, `/verify`, `/pro`, `/verified` and `/verified/<SAFE>` all return 200.
- Edit API, runtime:
  - other wallet's session: 403
  - `javascript:` link from the creator: 400
  - an https link containing `"><script>` is saved and rendered percent-encoded

Not done:
- The new sign-in-before-checkout step and the team-link form have not been clicked in a real browser with Phantom.
- A Phone-only creator can no longer start a Verified checkout from the QR/link form without a browser wallet to sign with. This is the intended trade-off.
- Notes A and B in section 2 are unchanged.

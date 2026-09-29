# How to get each key

Lens runs with no keys. Add a key only for the part you want to turn on. Put every secret in a file named `.env` in the project folder. Copy `.env.example` to `.env` and fill in the lines you need. Do not commit `.env`. Do not paste keys into the chat log of a deploy dashboard if you can use that host's secret store instead. The names below are the names in `.env`.

## X (the bot account)

You need this only if `X_MODE=live`. Mock mode does not call X.

Lens can log in as the bot in two ways. Set `X_AUTH_MODE` to `oauth2` or `oauth1`. If you leave it out, Lens uses OAuth 1.0a.

### OAuth 2.0 (user login, PKCE)

Use this when the X developer portal gave you a client id and a client secret, not the four OAuth 1.0a keys. The access token dies after 2 hours. The refresh token is replaced every time Lens asks for a new access token. Lens saves the new pair in the database and in `data/x-oauth2.json`. That file is gitignored. Do not commit it.

1. Open [https://developer.x.com](https://developer.x.com) and sign in with the X account that will post as the bot.
2. Sign up for a developer account if you do not have one. Say you are posting replies from a bot you operate.
3. Create a project, then an app inside it.
4. Open the app's **User authentication settings**. Turn on **OAuth 2.0**. Choose a **confidential** client (a web app). That is what gives you a client secret. Permissions: **Read and write**. If you want Pro warning DMs, also allow **Direct messages**.
5. Set the callback URL to `http://127.0.0.1:4391/callback`. If you change it, set the same value as `X_OAUTH2_REDIRECT_URI`.
6. Allow these scopes: `tweet.read`, `tweet.write`, `users.read`, `dm.read`, `dm.write`, and `offline.access`. `offline.access` is the one that returns a refresh token. Without it, Lens cannot stay logged in.
7. On the keys page, copy:
   - Client ID → `X_OAUTH2_CLIENT_ID`
   - Client Secret → `X_OAUTH2_CLIENT_SECRET`
8. In `.env` set `X_MODE=live` and `X_AUTH_MODE=oauth2`.
9. Run `npm run x:oauth2-login`. It prints a link. Open it, approve the app, and the script saves the tokens. You do not paste the access token or the refresh token into the chat. You can also paste them into `.env` as `X_OAUTH2_ACCESS_TOKEN` and `X_OAUTH2_REFRESH_TOKEN` if you already have them. The saved database row is used after the first refresh, because the old refresh token stops working.
10. `X_BOT_USER_ID` is optional. If you leave it empty, the worker asks X who the token belongs to.

If a refresh fails, or you lose the saved tokens, run `npm run x:oauth2-login` again. That writes a new pair over the old one.

On a server, keep the database (Postgres, or the SQLite file on a disk that survives restarts). The env refresh token is only the first seed. After Lens refreshes, the database has the token that still works.

### OAuth 1.0a

Use this if the portal shows an API key and an access token secret instead.

1. In user authentication settings, turn on **OAuth 1.0a**. Permissions: **Read and write**, plus **Direct messages** if you want DMs.
2. Set any callback URL. `http://127.0.0.1:3847` is enough. X requires one even if you only generate tokens in the dashboard.
3. Open **Keys and tokens**. Generate:
   - API Key → `X_API_KEY`
   - API Key Secret → `X_API_SECRET`
   - Access Token → `X_ACCESS_TOKEN`
   - Access Token Secret → `X_ACCESS_SECRET`
4. The access token must belong to the bot user. If you change permissions, generate the access token again. An old read-only token cannot post.
5. In `.env` set `X_MODE=live` and `X_AUTH_MODE=oauth1` (or leave `X_AUTH_MODE` empty).

### App-only bearer token

`X_BEARER_TOKEN` is optional. Lens can use it to read the parent post of a mention. It cannot post, reply, or send a DM. Leave it empty if you do not have one.

Live DMs use the user token and `sendDm`. X only delivers them if the app was granted DM access and the recipient can receive DMs from the bot. Tests use a fake client and do not call X.

## Helius (mainnet token reads)

You need this when the public mainnet RPC starts answering 429. DexScreener and RugCheck do not need a key.

1. Open [https://www.helius.dev](https://www.helius.dev) and create an account.
2. Create an API key in the dashboard.
3. Put it in `.env` as `HELIUS_API_KEY=...`
4. Leave `DATA_RPC_URL` empty. Lens then calls `https://mainnet.helius-rpc.com/?api-key=...` for mint accounts and holder lists.

If you already have another mainnet RPC URL, set `DATA_RPC_URL` to that URL and leave `HELIUS_API_KEY` empty. Do not put the key in a second variable. The URL's query string is stripped from logs.

`SOLANA_RPC_URL` is separate. It is the devnet URL used to write proof memos. The default `https://api.devnet.solana.com` is fine until you outgrow it.

## Devnet SOL (proofs, not an API key)

This is a keypair file, not a vendor key.

1. Run `npm run setup:devnet`.
2. The script writes `data/devnet-keypair.json` and asks the devnet faucet for SOL. That file is gitignored. Do not commit it.
3. In `.env` set `PROOF_MODE=solana` and `SOLANA_KEYPAIR_PATH=data/devnet-keypair.json`.
4. If the script prints HTTP 429, the public airdrop is rate-limited for your IP. Open [https://faucet.solana.com](https://faucet.solana.com), choose Devnet, sign in with GitHub, and send SOL to the pubkey the script printed. Then run `npm run setup:devnet` again. It keeps the same file once it exists. A balance of about 0.05 SOL is enough for many memos.
5. `npm run demo:devnet` sends one real memo and prints an explorer link.

## LLM (wording only)

Skip this if the template replies are enough. The model cannot change LOW / MEDIUM / HIGH.

1. Create an API key at [https://platform.openai.com](https://platform.openai.com), or any host that speaks the OpenAI chat-completions API.
2. Put it in `.env` as `LLM_API_KEY=...` (or `OPENAI_API_KEY=...`).
3. Leave `LLM_MODE=auto`. If the key is missing, Lens uses the template. Set `LLM_MODE=template` to force the template even when a key is present.
4. For a non-OpenAI host, also set `LLM_BASE_URL` (no trailing path beyond `/v1`) and `LLM_MODEL`.

## Pro payments (your wallet, not a vendor key)

Lens does not take card numbers. Pro is a USDC transfer on Solana mainnet.

1. Use a wallet you control as the treasury.
2. Set `PRO_TREASURY_WALLET` to that wallet's address.
3. Leave `USDC_MINT` empty. Lens uses mainnet USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`).
4. `PRO_PRICE_USDC` defaults to 10 and `PRO_PERIOD_DAYS` defaults to 30.
5. `PRO_RPC_URL` defaults to the same mainnet RPC as token reads, because the payment is on mainnet even when memos are on devnet.

## Birdeye (optional)

Only for extra security fields, including creator-sold percent when Birdeye returns it.

1. Create a key at [https://birdeye.so](https://birdeye.so).
2. Set `BIRDEYE_API_KEY`.

DexScreener, RugCheck, and Jupiter lite quotes need no key.

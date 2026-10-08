import { isActivePro, isSolanaAddress, safeSymbol, watchChangeAllowed } from "@lens/core";
import { route } from "@/lib/api";
import { getRuntime } from "@/lib/runtime";
import { sameOrigin, sessionWallet } from "@/lib/wallet-session";

export const dynamic = "force-dynamic";

/** Watchlist writes need the session cookie of the paying wallet. The body never chooses the account. */
async function signedInAccount(request: Request) {
  if (!sameOrigin(request.headers)) {
    return { ok: false as const, response: Response.json({ error: "Open this page on the Lens site." }, { status: 403 }) };
  }
  const wallet = await sessionWallet();
  const rt = await getRuntime();
  const user = wallet ? await rt.store.findUser({ wallet }) : null;
  const allowed = watchChangeAllowed({ unlocked: Boolean(user), activePro: isActivePro(user) });
  if (!allowed.ok) return { ok: false as const, response: Response.json({ error: allowed.error }, { status: allowed.status }) };
  return { ok: true as const, rt, user: user! };
}

async function readMint(request: Request) {
  const body = (await request.json().catch(() => null)) as { mint?: string; symbol?: string } | null;
  return { mint: body?.mint?.trim() ?? "", symbol: body?.symbol?.trim() ?? "" };
}

async function handlePost(request: Request) {
  const account = await signedInAccount(request);
  if (!account.ok) return account.response;
  const { mint, symbol } = await readMint(request);
  if (!isSolanaAddress(mint)) {
    return Response.json({ error: "That is not a Solana token address." }, { status: 400 });
  }
  const watch = await account.rt.store.addWatch(account.user.id, mint, safeSymbol(symbol || "TOKEN", mint));
  return Response.json({ watch, watches: await account.rt.store.listWatches(account.user.id) });
}

async function handleDelete(request: Request) {
  const account = await signedInAccount(request);
  if (!account.ok) return account.response;
  const { mint } = await readMint(request);
  if (!isSolanaAddress(mint)) {
    return Response.json({ error: "That is not a Solana token address." }, { status: 400 });
  }
  await account.rt.store.removeWatch(account.user.id, mint);
  return Response.json({ watches: await account.rt.store.listWatches(account.user.id) });
}

export const POST = route("watch POST", handlePost);
export const DELETE = route("watch DELETE", handleDelete);

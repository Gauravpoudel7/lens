import { isActivePro, isSolanaAddress, safeSymbol, watchChangeAllowed } from "@lens/core";
import { getRuntime } from "@/lib/runtime";
import { readWalletProof, walletUnlocks } from "@/lib/wallet-session";

export const dynamic = "force-dynamic";

async function findAccount(handle: string, wallet: string) {
  const rt = await getRuntime();
  const user =
    (wallet ? await rt.store.findUser({ wallet }) : null) ??
    (handle ? await rt.store.findUser({ xHandle: handle }) : null);
  return { rt, user };
}

function authorize(user: { wallet: string | null; proUntil: string | null } | null, body: Record<string, unknown> | null) {
  const proof = readWalletProof(body);
  const allowed = watchChangeAllowed({
    unlocked: walletUnlocks(user, proof),
    activePro: isActivePro(user),
  });
  return allowed;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    xHandle?: string;
    wallet?: string;
    mint?: string;
    symbol?: string;
    nonce?: string;
    expiresAt?: number;
    signature?: string;
  } | null;
  const { rt, user } = await findAccount(body?.xHandle?.trim() ?? "", body?.wallet?.trim() ?? "");
  if (!user) return Response.json({ error: "No account for that handle or wallet." }, { status: 404 });
  const allowed = authorize(user, body);
  if (!allowed.ok) return Response.json({ error: allowed.error }, { status: allowed.status });
  const mint = body?.mint?.trim() ?? "";
  if (!isSolanaAddress(mint)) {
    return Response.json({ error: "That is not a Solana token address." }, { status: 400 });
  }
  const symbol = safeSymbol(body?.symbol?.trim() || "TOKEN", mint);
  const watch = await rt.store.addWatch(user.id, mint, symbol);
  const watches = await rt.store.listWatches(user.id);
  return Response.json({ watch, watches });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    xHandle?: string;
    wallet?: string;
    mint?: string;
    nonce?: string;
    expiresAt?: number;
    signature?: string;
  } | null;
  const { rt, user } = await findAccount(body?.xHandle?.trim() ?? "", body?.wallet?.trim() ?? "");
  if (!user) return Response.json({ error: "No account for that handle or wallet." }, { status: 404 });
  const allowed = authorize(user, body);
  if (!allowed.ok) return Response.json({ error: allowed.error }, { status: allowed.status });
  const mint = body?.mint?.trim() ?? "";
  await rt.store.removeWatch(user.id, mint);
  return Response.json({ watches: await rt.store.listWatches(user.id) });
}

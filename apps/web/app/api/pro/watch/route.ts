import { isActivePro, isSolanaAddress } from "@lens/core";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

async function findAccount(handle: string, wallet: string) {
  const rt = await getRuntime();
  const user =
    (wallet ? await rt.store.findUser({ wallet }) : null) ??
    (handle ? await rt.store.findUser({ xHandle: handle }) : null);
  return { rt, user };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    xHandle?: string;
    wallet?: string;
    mint?: string;
    symbol?: string;
  } | null;
  const { rt, user } = await findAccount(body?.xHandle?.trim() ?? "", body?.wallet?.trim() ?? "");
  if (!user) return Response.json({ error: "No account for that handle or wallet." }, { status: 404 });
  if (!isActivePro(user)) {
    return Response.json({ error: "Watchlist alerts are part of Pro." }, { status: 403 });
  }
  const mint = body?.mint?.trim() ?? "";
  if (!isSolanaAddress(mint)) {
    return Response.json({ error: "That is not a Solana token address." }, { status: 400 });
  }
  const symbol = body?.symbol?.trim() || `${mint.slice(0, 4)}…${mint.slice(-4)}`;
  const watch = await rt.store.addWatch(user.id, mint, symbol);
  const watches = await rt.store.listWatches(user.id);
  return Response.json({ watch, watches });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    xHandle?: string;
    wallet?: string;
    mint?: string;
  } | null;
  const { rt, user } = await findAccount(body?.xHandle?.trim() ?? "", body?.wallet?.trim() ?? "");
  if (!user) return Response.json({ error: "No account for that handle or wallet." }, { status: 404 });
  const mint = body?.mint?.trim() ?? "";
  await rt.store.removeWatch(user.id, mint);
  return Response.json({ watches: await rt.store.listWatches(user.id) });
}

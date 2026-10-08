import { issueOrReuseLinkCode, redactAccount } from "@lens/core";
import { route } from "@/lib/api";
import { getRuntime } from "@/lib/runtime";
import { sessionWallet } from "@/lib/wallet-session";

export const dynamic = "force-dynamic";

/**
 * With no query, the signed-in wallet's own account. With `?handle=` or `?wallet=`, a public lookup that says only
 * whether Pro is active, unless it is the signed-in wallet's own record.
 */
async function handleGet(request: Request) {
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle")?.trim() ?? "";
  const wallet = url.searchParams.get("wallet")?.trim() ?? "";
  const signedIn = await sessionWallet();
  if (!handle && !wallet && !signedIn) {
    return Response.json({ error: "Enter an X handle or a wallet." }, { status: 400 });
  }
  const rt = await getRuntime();
  const user =
    handle || wallet
      ? ((wallet ? await rt.store.findUser({ wallet }) : null) ??
        (handle ? await rt.store.findUser({ xHandle: handle }) : null))
      : await rt.store.findUser({ wallet: signedIn! });
  const unlocked = Boolean(signedIn && user?.wallet === signedIn);
  const watches = user && unlocked ? await rt.store.listWatches(user.id) : [];
  // The X link code is the key to this plan's X perks, so only the signed-in wallet sees it.
  const code = user && unlocked ? await issueOrReuseLinkCode(rt.store, user) : null;
  return Response.json({
    ...redactAccount({ user, watches, queriedHandle: handle, unlocked }),
    signedIn,
    linkCode: code ? { code: code.code, expiresAt: code.expiresAt } : null,
  });
}

export const GET = route("account GET", handleGet);

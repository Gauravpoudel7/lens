import { redactAccount } from "@lens/core";
import { getRuntime } from "@/lib/runtime";
import { readWalletProof, walletUnlocks } from "@/lib/wallet-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle") ?? "";
  const wallet = url.searchParams.get("wallet") ?? "";
  if (!handle && !wallet) {
    return Response.json({ error: "Pass a handle or a wallet." }, { status: 400 });
  }
  const rt = await getRuntime();
  const user =
    (wallet ? await rt.store.findUser({ wallet }) : null) ??
    (handle ? await rt.store.findUser({ xHandle: handle }) : null);
  const proof = readWalletProof({
    proofWallet: url.searchParams.get("proofWallet"),
    nonce: url.searchParams.get("nonce"),
    expiresAt: url.searchParams.get("expiresAt"),
    signature: url.searchParams.get("signature"),
  });
  const watches = user && walletUnlocks(user, proof) ? await rt.store.listWatches(user.id) : [];
  return Response.json(
    redactAccount({
      user,
      watches,
      queriedHandle: handle,
      unlocked: walletUnlocks(user, proof),
    }),
  );
}

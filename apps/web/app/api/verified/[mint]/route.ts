import { cleanTeamInfo, isActiveListing, isSolanaAddress } from "@lens/core";
import { route } from "@/lib/api";
import { getRuntime } from "@/lib/runtime";
import { sameOrigin, sessionWallet } from "@/lib/wallet-session";

export const dynamic = "force-dynamic";

/** Team links. Only the signed-in wallet that paid for an active listing may change them. */
async function handlePost(request: Request, context: { params: Promise<{ mint: string }> }) {
  if (!sameOrigin(request.headers)) return Response.json({ error: "Open this page on the Lens site." }, { status: 403 });
  const { mint } = await context.params;
  if (!isSolanaAddress(mint)) return Response.json({ error: "That is not a Solana token address." }, { status: 400 });
  const wallet = await sessionWallet();
  if (!wallet) {
    return Response.json({ error: "Sign in with the creator wallet first.", reason: "signin" }, { status: 401 });
  }
  const rt = await getRuntime();
  const listing = await rt.store.getVerifiedListing(mint);
  if (!listing || !isActiveListing(listing)) {
    return Response.json({ error: "This token has no active Verified page." }, { status: 404 });
  }
  if (listing.ownerWallet !== wallet) {
    return Response.json({ error: "Only the wallet that paid for this page can edit it." }, { status: 403 });
  }
  const cleaned = cleanTeamInfo((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (!cleaned.ok) return Response.json({ error: cleaned.error }, { status: 400 });
  const saved = await rt.store.updateVerifiedInfo(mint, cleaned.info);
  return Response.json({ listing: saved });
}

export const POST = route("verified info POST", handlePost);

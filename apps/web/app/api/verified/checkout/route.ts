import { startVerifiedCheckout } from "@lens/core";
import { billingDeps } from "@/lib/billing";
import { route } from "@/lib/api";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { getRuntime } from "@/lib/runtime";
import { sameOrigin, sessionWallet } from "@/lib/wallet-session";

export const dynamic = "force-dynamic";

/**
 * Starts a Verified checkout. Only the token's creator wallet gets a payment reference, and only after it signed in,
 * because the creator address is public and anyone could otherwise type it and pay.
 */
async function handlePost(request: Request) {
  if (!sameOrigin(request.headers)) return Response.json({ error: "Open this page on the Lens site." }, { status: 403 });
  const rt = await getRuntime();
  // Each start reads the token from the data providers, so it shares the check limit.
  if (!allowRequest(clientKey(request, "verified-checkout"), rt.config.checkApiLimitPerHour)) {
    return Response.json({ error: "Too many payment requests from this address. Try again later." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { wallet?: string; mint?: string } | null;
  const signedIn = await sessionWallet();
  if (!signedIn) {
    return Response.json({ error: "Sign in with the creator wallet first.", reason: "signin" }, { status: 401 });
  }
  if (signedIn !== body?.wallet?.trim()) {
    return Response.json({ error: "Sign in with the wallet you will pay from." }, { status: 403 });
  }
  const deps = await billingDeps();
  const result = await startVerifiedCheckout({ ...deps, provider: rt.provider }, { wallet: body?.wallet, mint: body?.mint });
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ userId: result.user.id, wallet: result.user.wallet, session: result.session });
}

export const POST = route("verified checkout POST", handlePost);

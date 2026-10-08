import { route } from "@/lib/api";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { getRuntime } from "@/lib/runtime";
import { endSession, proofIsValid, readWalletProof, sameOrigin, startSession } from "@/lib/wallet-session";

export const dynamic = "force-dynamic";

/** Trades one fresh wallet signature for a 24 h httpOnly session cookie bound to that wallet. */
async function handlePost(request: Request) {
  if (!sameOrigin(request.headers)) return Response.json({ error: "Open this page on the Lens site." }, { status: 403 });
  const rt = await getRuntime();
  if (!allowRequest(clientKey(request, "session"), rt.config.checkApiLimitPerHour)) {
    return Response.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429 });
  }
  const proof = readWalletProof((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (!proof || !proofIsValid(proof)) {
    return Response.json({ error: "The signature did not match. Sign in again." }, { status: 401 });
  }
  await startSession(proof.wallet);
  return Response.json({ wallet: proof.wallet });
}

async function handleDelete(request: Request) {
  if (!sameOrigin(request.headers)) return Response.json({ error: "Open this page on the Lens site." }, { status: 403 });
  await endSession();
  return Response.json({ ok: true });
}

export const POST = route("session POST", handlePost);
export const DELETE = route("session DELETE", handleDelete);

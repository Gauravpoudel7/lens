import { startUsdcCheckout } from "@lens/core";
import { billingDeps } from "@/lib/billing";
import { route } from "@/lib/api";

export const dynamic = "force-dynamic";

async function handlePost(request: Request) {
  const body = (await request.json().catch(() => null)) as { xHandle?: string; wallet?: string } | null;
  const deps = await billingDeps();
  // A handle is refused here on purpose: X accounts are linked later, only by a DM code.
  const result = await startUsdcCheckout(deps, { wallet: body?.wallet, xHandle: body?.xHandle });
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({
    userId: result.user.id,
    wallet: result.user.wallet,
    session: result.session,
  });
}

export const POST = route("checkout POST", handlePost);

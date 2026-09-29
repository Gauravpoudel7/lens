import { startUsdcCheckout } from "@lens/core";
import { billingDeps } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { xHandle?: string; wallet?: string } | null;
  const deps = await billingDeps();
  const result = await startUsdcCheckout(deps, {
    xHandle: body?.xHandle,
    wallet: body?.wallet,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({
    userId: result.user.id,
    handle: result.user.xHandle,
    wallet: result.user.wallet,
    session: result.session,
  });
}

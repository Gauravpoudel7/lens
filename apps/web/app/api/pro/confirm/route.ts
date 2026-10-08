import { confirmUsdcCheckout, proStatus } from "@lens/core";
import { billingDeps } from "@/lib/billing";
import { route } from "@/lib/api";

export const dynamic = "force-dynamic";

async function handlePost(request: Request) {
  const body = (await request.json().catch(() => null)) as { reference?: string } | null;
  const reference = body?.reference?.trim() ?? "";
  if (!reference) return Response.json({ error: "Paste the payment reference." }, { status: 400 });
  const deps = await billingDeps();
  const result = await confirmUsdcCheckout(deps, reference);
  if (!result.ok) {
    // Not paid yet is a normal answer while polling, not a failed request.
    const status = result.reason === "pending" ? 202 : 402;
    return Response.json({ error: result.error, reason: result.reason }, { status });
  }
  // The reference is public on-chain, so the reply carries only what the payer already knows: the wallet.
  return Response.json({
    signature: result.signature,
    already: result.already,
    user: { wallet: result.user.wallet },
    ...proStatus(result.user),
  });
}

export const POST = route("confirm POST", handlePost);

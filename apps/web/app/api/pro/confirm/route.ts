import { confirmUsdcCheckout, proStatus } from "@lens/core";
import { billingDeps } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { reference?: string } | null;
  const reference = body?.reference?.trim() ?? "";
  if (!reference) return Response.json({ error: "Paste the payment reference." }, { status: 400 });
  const deps = await billingDeps();
  const result = await confirmUsdcCheckout(deps, reference);
  if (!result.ok) return Response.json({ error: result.error, reason: result.reason }, { status: 402 });
  return Response.json({
    signature: result.signature,
    already: result.already,
    user: result.user,
    ...proStatus(result.user),
  });
}

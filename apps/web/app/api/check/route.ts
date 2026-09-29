import { createRiskCheck, isActivePro } from "@lens/core";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rt = await getRuntime();
  const body = (await request.json().catch(() => null)) as { input?: string; wallet?: string } | null;
  const wallet = body?.wallet?.trim() ?? "";
  const payer = wallet ? await rt.store.findUser({ wallet }) : null;
  const pro = isActivePro(payer);
  if (!pro && !allowRequest(clientKey(request), rt.config.checkApiLimitPerHour)) {
    return Response.json({ error: "Too many checks from this address. Try again later." }, { status: 429 });
  }
  const input = body?.input?.trim() ?? "";
  if (!input) {
    return Response.json({ error: "Paste a token address, a $ticker, or the text of a post." }, { status: 400 });
  }
  const created = await createRiskCheck(rt, {
    kind: "manual",
    text: input,
    claimText: input,
  });
  if (!created.ok) {
    const status = created.error === "proof_failed" ? 502 : 404;
    const error =
      created.error === "no_token"
        ? "No Solana token address or $ticker was found in that text."
        : created.error === "token_not_found"
          ? "That token could not be loaded from the data provider."
          : `The proof was not saved. ${created.detail ?? ""}`.trim();
    return Response.json({ error }, { status });
  }
  return Response.json({
    id: created.check.id,
    riskLevel: created.check.riskLevel,
    replyText: created.check.replyText,
    reportUrl: `${rt.config.publicBaseUrl}/r/${created.check.id}`,
    proof: created.check.proof,
  });
}

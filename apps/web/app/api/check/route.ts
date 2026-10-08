import { createRiskCheck } from "@lens/core";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { getRuntime } from "@/lib/runtime";
import { PROOF_FAILED_MESSAGE, route } from "@/lib/api";

export const dynamic = "force-dynamic";

async function handlePost(request: Request) {
  const rt = await getRuntime();
  if (!allowRequest(clientKey(request), rt.config.checkApiLimitPerHour)) {
    return Response.json({ error: "Too many checks from this address. Try again later." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { input?: string } | null;
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
    if (created.error === "notice") {
      return Response.json({ error: created.detail }, { status: 422 });
    }
    const status = created.error === "proof_failed" ? 502 : 404;
    const error =
      created.error === "no_token"
        ? "No Solana token address or $ticker was found in that text."
        : created.error === "token_not_found"
          ? "That token could not be loaded. Check the address and try again."
          : PROOF_FAILED_MESSAGE;
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

export const POST = route("check POST", handlePost);

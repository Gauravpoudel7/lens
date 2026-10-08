import { createRpcCheckoutReader, prepareCheckoutTx } from "@lens/core";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { getRuntime } from "@/lib/runtime";
import { route } from "@/lib/api";

export const dynamic = "force-dynamic";

async function handlePost(request: Request) {
  const rt = await getRuntime();
  if (!allowRequest(clientKey(request, "pro-tx"), rt.config.checkApiLimitPerHour)) {
    return Response.json({ error: "Too many payment requests from this address. Try again later." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { reference?: string; account?: string } | null;
  const reader = createRpcCheckoutReader(rt.config.proRpcUrl, rt.config.rpcRetryAttempts);
  const result = await prepareCheckoutTx(
    { config: rt.config, store: rt.store, reader },
    { reference: body?.reference, account: body?.account },
  );
  if (!result.ok) return Response.json({ error: result.error, reason: result.reason }, { status: 400 });
  return Response.json({ transaction: result.transaction, network: result.network });
}

export const POST = route("checkout tx POST", handlePost);

import { createRpcCheckoutReader, logError, prepareCheckoutTx } from "@lens/core";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rt = await getRuntime();
  if (!allowRequest(clientKey(request, "pro-tx"), rt.config.checkApiLimitPerHour)) {
    return Response.json({ error: "Too many payment requests from this address. Try again later." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { reference?: string; account?: string } | null;
  const reader = createRpcCheckoutReader(rt.config.proRpcUrl, rt.config.rpcRetryAttempts);
  const result = await prepareCheckoutTx(
    { config: rt.config, store: rt.store, reader },
    { reference: body?.reference, account: body?.account },
  ).catch((error: unknown) => {
    // RPC errors name the method, not the URL, so the Helius key stays out of the log.
    logError("pro checkout tx", { detail: error instanceof Error ? error.message : String(error) });
    return null;
  });
  if (!result) {
    return Response.json({ error: "Could not reach Solana to build the payment. Try again.", reason: "rpc" }, { status: 502 });
  }
  if (!result.ok) return Response.json({ error: result.error, reason: result.reason }, { status: 400 });
  return Response.json({ transaction: result.transaction, network: result.network });
}

import { createRpcCheckoutReader } from "@lens/core";
import { route } from "@/lib/api";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

/** The network Pro payments run on, read from the genesis hash of PRO_RPC_URL (cached per process). */
async function handleGet() {
  const rt = await getRuntime();
  const network = await createRpcCheckoutReader(rt.config.proRpcUrl, rt.config.rpcRetryAttempts).network();
  return Response.json({ network });
}

export const GET = route("pro network GET", handleGet);

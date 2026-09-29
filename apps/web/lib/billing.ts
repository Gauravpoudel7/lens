import { createRpcPaymentChain, type BillingDeps } from "@lens/core";
import { getRuntime } from "./runtime";

export async function billingDeps(): Promise<BillingDeps & { publicBaseUrl: string }> {
  const rt = await getRuntime();
  return {
    config: rt.config,
    store: rt.store,
    chain: createRpcPaymentChain(rt.config.proRpcUrl, rt.config.rpcRetryAttempts),
    publicBaseUrl: rt.config.publicBaseUrl,
  };
}

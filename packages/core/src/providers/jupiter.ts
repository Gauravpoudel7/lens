import { PublicKey } from "@solana/web3.js";
import type { LensConfig } from "../types.js";

export const WSOL_MINT = "So11111111111111111111111111111111111111112";

export interface SwapBuilder {
  buildBuyTransaction(input: {
    userPublicKey: string;
    outputMint: string;
    amountLamports: number;
    slippageBps: number;
  }): Promise<{ transaction: string } | { error: string }>;
}

export function createSwapBuilder(
  config: Pick<LensConfig, "dataMode" | "jupiterBaseUrl" | "jupiterFeeBps" | "jupiterFeeAccount">,
): SwapBuilder {
  if (config.dataMode !== "live") {
    return {
      async buildBuyTransaction() {
        return {
          error:
            "Jupiter swaps are off in mock mode. Set DATA_MODE=live to build a real swap transaction.",
        };
      },
    };
  }
  return {
    async buildBuyTransaction(input) {
      try {
        new PublicKey(input.userPublicKey);
        new PublicKey(input.outputMint);
      } catch {
        return { error: "Wallet or token address is not a Solana public key." };
      }
      const params = new URLSearchParams({
        inputMint: WSOL_MINT,
        outputMint: input.outputMint,
        amount: String(input.amountLamports),
        slippageBps: String(input.slippageBps),
      });
      const feeAccount = config.jupiterFeeAccount;
      if (feeAccount && config.jupiterFeeBps > 0) {
        params.set("platformFeeBps", String(config.jupiterFeeBps));
      }
      const quoteUrl = `${config.jupiterBaseUrl}/swap/v1/quote?${params.toString()}`;
      const quoteResponse = await fetch(quoteUrl, { signal: AbortSignal.timeout(8_000) });
      if (!quoteResponse.ok) {
        const body = await quoteResponse.text();
        return { error: `Jupiter quote failed (${quoteResponse.status}): ${body.slice(0, 180)}` };
      }
      const quote = await quoteResponse.json();
      const swapResponse = await fetch(`${config.jupiterBaseUrl}/swap/v1/swap`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: input.userPublicKey,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          ...(feeAccount ? { feeAccount } : {}),
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!swapResponse.ok) {
        const body = await swapResponse.text();
        return { error: `Jupiter swap failed (${swapResponse.status}): ${body.slice(0, 180)}` };
      }
      const json = (await swapResponse.json()) as { swapTransaction?: string; error?: string };
      if (!json.swapTransaction) {
        return { error: json.error ?? "Jupiter did not return a transaction." };
      }
      return { transaction: json.swapTransaction };
    },
  };
}

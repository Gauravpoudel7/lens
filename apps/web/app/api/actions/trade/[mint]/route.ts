import { ACTION_RESPONSE_HEADERS, buildBlinkAction, createSwapBuilder, isSolanaAddress } from "@lens/core";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { getRuntime } from "@/lib/runtime";
import { loadTradeCheck } from "@/lib/trade-check";

export const dynamic = "force-dynamic";

const HEADERS = ACTION_RESPONSE_HEADERS;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}

// GET and POST rate-limit every request before calling this, so the loader's own gate always passes.
async function loadCheck(mint: string) {
  const rt = await getRuntime();
  const loaded = await loadTradeCheck(rt, mint, () => true);
  return { rt, ...loaded };
}

export async function GET(request: Request, context: { params: Promise<{ mint: string }> }) {
  const { mint } = await context.params;
  if (!isSolanaAddress(mint)) {
    return Response.json({ message: "That is not a Solana token address." }, { status: 400, headers: HEADERS });
  }
  const rt = await getRuntime();
  if (!allowRequest(clientKey(request, "trade"), rt.config.checkApiLimitPerHour)) {
    return Response.json({ message: "Too many checks from this address. Try again later." }, { status: 429, headers: HEADERS });
  }
  const loaded = await loadCheck(mint);
  if (!loaded.check) {
    return Response.json(
      { message: loaded.error === "token_not_found" ? "Token not found." : (loaded.detail ?? "Token not found.") },
      { status: loaded.error === "proof_failed" ? 502 : 404, headers: HEADERS },
    );
  }
  return Response.json(buildBlinkAction(loaded.check, loaded.rt.config), { headers: HEADERS });
}

export async function POST(request: Request, context: { params: Promise<{ mint: string }> }) {
  const { mint } = await context.params;
  if (!isSolanaAddress(mint)) {
    return Response.json({ message: "That is not a Solana token address." }, { status: 400, headers: HEADERS });
  }
  const rt = await getRuntime();
  if (!allowRequest(clientKey(request, "trade"), rt.config.checkApiLimitPerHour)) {
    return Response.json({ message: "Too many checks from this address. Try again later." }, { status: 429, headers: HEADERS });
  }
  const url = new URL(request.url);
  const amount = Number(url.searchParams.get("amount") ?? "0.1");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 50) {
    return Response.json({ message: "Amount must be between 0 and 50 SOL." }, { status: 400, headers: HEADERS });
  }
  const body = (await request.json().catch(() => ({}))) as { account?: string };
  if (!body.account || !isSolanaAddress(body.account)) {
    return Response.json({ message: "Missing wallet account." }, { status: 400, headers: HEADERS });
  }
  const loaded = await loadCheck(mint);
  if (!loaded.check) {
    return Response.json({ message: "Token not found." }, { status: 404, headers: HEADERS });
  }
  if (loaded.check.riskLevel === "HIGH") {
    return Response.json(
      {
        message: `Lens rated $${loaded.check.tokenSymbol} HIGH risk. Buying is turned off. Not financial advice.`,
      },
      { status: 403, headers: HEADERS },
    );
  }
  const built = await createSwapBuilder(loaded.rt.config).buildBuyTransaction({
    userPublicKey: body.account,
    outputMint: mint,
    amountLamports: Math.round(amount * 1_000_000_000),
    slippageBps: 100,
  });
  if ("error" in built) {
    return Response.json({ message: built.error }, { status: 400, headers: HEADERS });
  }
  return Response.json(
    {
      transaction: built.transaction,
      message: `${loaded.check.riskLevel} risk. Not financial advice.`,
    },
    { headers: HEADERS },
  );
}

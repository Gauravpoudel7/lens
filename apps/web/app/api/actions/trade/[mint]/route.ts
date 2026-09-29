import { buildBlinkAction, createRiskCheck, createSwapBuilder } from "@lens/core";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Version, X-Accept-Blockchain-Ids",
  "Content-Type": "application/json",
  "X-Action-Version": "2.4",
  "X-Blockchain-Ids": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}

async function loadCheck(mint: string) {
  const rt = await getRuntime();
  const recent = await rt.store.latestCheckForMint(mint, 15 * 60 * 1000);
  if (recent && recent.riskLevel !== "NONE") return { rt, check: recent };
  const created = await createRiskCheck(rt, { kind: "blink", mint, claimText: "" });
  if (!created.ok) return { rt, check: null, error: created.error, detail: created.detail };
  return { rt, check: created.check };
}

export async function GET(_request: Request, context: { params: Promise<{ mint: string }> }) {
  const { mint } = await context.params;
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
  const url = new URL(request.url);
  const amount = Number(url.searchParams.get("amount") ?? "0.1");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 50) {
    return Response.json({ message: "Amount must be between 0 and 50 SOL." }, { status: 400, headers: HEADERS });
  }
  const body = (await request.json().catch(() => ({}))) as { account?: string };
  if (!body.account) {
    return Response.json({ message: "Missing wallet account." }, { status: 400, headers: HEADERS });
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

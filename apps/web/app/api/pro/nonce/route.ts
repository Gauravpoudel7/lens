import { isSolanaAddress } from "@lens/core";
import { walletNonces } from "@/lib/wallet-nonce";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { wallet?: string } | null;
  const wallet = body?.wallet?.trim() ?? "";
  if (!isSolanaAddress(wallet)) {
    return Response.json({ error: "That wallet address is not valid." }, { status: 400 });
  }
  const issued = walletNonces.issue(wallet);
  return Response.json(issued);
}

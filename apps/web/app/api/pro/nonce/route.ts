import { isSolanaAddress } from "@lens/core";
import { walletNonces } from "@/lib/wallet-nonce";
import { route } from "@/lib/api";

export const dynamic = "force-dynamic";

async function handlePost(request: Request) {
  const body = (await request.json().catch(() => null)) as { wallet?: string } | null;
  const wallet = body?.wallet?.trim() ?? "";
  if (!isSolanaAddress(wallet)) {
    return Response.json({ error: "That wallet address is not valid." }, { status: 400 });
  }
  const issued = walletNonces.issue(wallet);
  return Response.json(issued);
}

export const POST = route("nonce POST", handlePost);

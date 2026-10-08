import { configuredProofSigner, verifyPostedText } from "@lens/core";
import { allowRequest, clientKey } from "@/lib/rate-limit";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

async function run(request: Request, text: string, signature: string) {
  if (!text || !signature) {
    return Response.json({ error: "Both text and signature are required." }, { status: 400 });
  }
  const rt = await getRuntime();
  if (!allowRequest(clientKey(request, "verify"), rt.config.checkApiLimitPerHour)) {
    return Response.json({ error: "Too many checks from this address. Try again later." }, { status: 429 });
  }
  const result = await verifyPostedText(
    rt.proofs,
    text,
    signature,
    configuredProofSigner(rt.config),
  );
  return Response.json(result);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: string; signature?: string } | null;
  return run(request, body?.text ?? "", body?.signature?.trim() ?? "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return run(request, url.searchParams.get("text") ?? "", url.searchParams.get("signature")?.trim() ?? "");
}

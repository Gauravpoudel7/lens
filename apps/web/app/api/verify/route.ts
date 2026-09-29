import { verifyPostedText } from "@lens/core";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

async function run(text: string, signature: string) {
  if (!text || !signature) {
    return Response.json({ error: "Both text and signature are required." }, { status: 400 });
  }
  const rt = await getRuntime();
  const result = await verifyPostedText(rt.proofs, text, signature);
  return Response.json(result);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: string; signature?: string } | null;
  return run(body?.text ?? "", body?.signature?.trim() ?? "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return run(url.searchParams.get("text") ?? "", url.searchParams.get("signature")?.trim() ?? "");
}

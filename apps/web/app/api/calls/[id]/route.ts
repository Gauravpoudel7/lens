import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const rt = await getRuntime();
  const check = await rt.store.getCheck(id);
  if (!check) return Response.json({ error: "Check not found." }, { status: 404 });
  return Response.json({ ...check, reportUrl: `${rt.config.publicBaseUrl}/r/${check.id}` });
}

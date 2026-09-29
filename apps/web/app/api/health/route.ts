import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const rt = await getRuntime();
  return Response.json({
    ok: true,
    dataMode: rt.config.dataMode,
    proofMode: rt.config.proofMode,
    xMode: rt.config.xMode,
    cluster: rt.config.solanaCluster,
  });
}

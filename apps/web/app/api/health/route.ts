import { errorMessage, logError } from "@lens/core";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rt = await getRuntime();
    await rt.store.getCursor("health");
    return Response.json({
      ok: true,
      dataMode: rt.config.dataMode,
      proofMode: rt.config.proofMode,
      xMode: rt.config.xMode,
      cluster: rt.config.solanaCluster,
      db: "ok",
      outboundDiscover: rt.config.outboundDiscover,
    });
  } catch (err) {
    logError("health check failed", { detail: errorMessage(err) });
    return Response.json(
      {
        ok: false,
        db: "error",
        error: "The database is not reachable.",
      },
      { status: 503 },
    );
  }
}

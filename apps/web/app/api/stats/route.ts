import { computeStats } from "@lens/core";
import { getRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const rt = await getRuntime();
  const checks = await rt.store.listChecks({ limit: 500 });
  const stats = computeStats(checks, {
    windowDays: rt.config.outcomeWindowDays,
    sharpDropPct: rt.config.sharpDropPct,
    callWinPct: rt.config.callWinPct,
  });
  return Response.json(stats);
}

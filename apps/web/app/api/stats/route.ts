import { SCORECARD_KINDS, computeStats } from "@lens/core";
import { getRuntime } from "@/lib/runtime";
import { route } from "@/lib/api";

export const dynamic = "force-dynamic";

async function handleGet() {
  const rt = await getRuntime();
  const checks = await rt.store.listChecks({ limit: 500, kinds: SCORECARD_KINDS });
  const stats = computeStats(checks, {
    windowDays: rt.config.outcomeWindowDays,
    sharpDropPct: rt.config.sharpDropPct,
    callWinPct: rt.config.callWinPct,
  });
  return Response.json(stats);
}

export const GET = route("stats GET", handleGet);

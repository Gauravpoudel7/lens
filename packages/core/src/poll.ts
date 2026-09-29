import { log } from "./ids.js";
import { flushQueuedAlerts } from "./alerts.js";
import { scoreDueChecks } from "./outcomes.js";
import { processMention, runOutboundCycle, type LensDeps } from "./pipeline.js";
import { compareIds } from "./x/mock.js";

export async function pollOnce(deps: LensDeps): Promise<{ seen: number; replied: number; scored: number }> {
  const since = await deps.store.getCursor("mentions");
  const posts = await deps.x.listMentions(since ?? undefined);
  const ordered = [...posts].sort((a, b) => compareIds(a.id, b.id));
  let replied = 0;
  for (const post of ordered) {
    try {
      const result = await processMention(deps, {
        id: post.id,
        authorId: post.authorId,
        authorUsername: post.authorUsername,
        text: post.text,
        parentId: post.parentId,
        createdAt: post.createdAt,
      });
      if (result.status === "replied") replied += 1;
    } catch (err) {
      log("poll mention failed", err instanceof Error ? err.message : err);
    }
    await deps.store.setCursor("mentions", post.id);
  }
  const outbound = await runOutboundCycle(deps);
  if (outbound.posted > 0) {
    log("posted outbound updates", { posted: outbound.posted, considered: outbound.considered });
  }
  await flushQueuedAlerts(deps);
  const scored = await scoreDueChecks(deps);
  return { seen: ordered.length, replied, scored };
}

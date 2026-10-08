import { log } from "./ids.js";
import { flushQueuedAlerts } from "./alerts.js";
import { redeemLinkCode } from "./billing/link.js";
import { scoreDueChecks } from "./outcomes.js";
import { processMention, runOutboundCycle, type LensDeps } from "./pipeline.js";
import { compareIds } from "./x/mock.js";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One poll at a time. The next wait starts after the previous poll finishes,
 * including when that poll throws.
 */
export async function runPollLoop(
  deps: LensDeps,
  intervalMs: number,
  hooks?: {
    poll?: (deps: LensDeps) => Promise<unknown>;
    sleep?: (ms: number) => Promise<void>;
    signal?: AbortSignal;
  },
): Promise<void> {
  const poll = hooks?.poll ?? pollOnce;
  const wait = hooks?.sleep ?? sleep;
  while (!hooks?.signal?.aborted) {
    try {
      await poll(deps);
    } catch (err) {
      log("poll failed", err instanceof Error ? err.message : err);
    }
    if (hooks?.signal?.aborted) break;
    await wait(intervalMs);
  }
}

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
  await pollDmLinks(deps);
  await flushQueuedAlerts(deps);
  const scored = await scoreDueChecks(deps);
  return { seen: ordered.length, replied, scored };
}

/**
 * Reads DMs for Pro link codes. X charges for DM reads, so this runs only while some paid account
 * has an open (unused, unexpired) code, and at most once per `xDmPollMs` (floor 3 minutes).
 */
export async function pollDmLinks(
  deps: LensDeps,
  now = new Date(),
): Promise<{ read: boolean; linked: number; replied: number }> {
  const idle = { read: false, linked: 0, replied: 0 };
  const open = await deps.store.oldestOpenLinkCode(now);
  if (!open) return idle;
  const last = Number(await deps.store.getCursor("dm_poll_at"));
  if (Number.isFinite(last) && last > 0 && now.getTime() - last < deps.config.xDmPollMs) return idle;
  await deps.store.setCursor("dm_poll_at", String(now.getTime()));

  const since = await deps.store.getCursor("dms");
  let dms;
  try {
    dms = await deps.x.listDms(since ?? undefined);
  } catch (err) {
    log("dm read failed", err instanceof Error ? err.message : err);
    return { ...idle, read: true };
  }
  // First run: skip history from before any open code existed.
  const fresh = since ? dms : dms.filter((dm) => Date.parse(dm.createdAt) >= Date.parse(open.createdAt));
  let linked = 0;
  let replied = 0;
  for (const dm of fresh) {
    try {
      const result = await redeemLinkCode(deps, {
        senderId: dm.senderId,
        senderHandle: dm.senderUsername,
        text: dm.text,
        now,
      });
      if (result.outcome === "linked") linked += 1;
      if (result.reply) {
        await deps.x.sendDm({ recipientId: dm.senderId, text: result.reply });
        replied += 1;
      }
      if (result.outcome !== "ignored") log("dm link", { outcome: result.outcome });
    } catch (err) {
      log("dm link failed", err instanceof Error ? err.message : err);
    }
  }
  const newest = dms.at(-1);
  if (newest) await deps.store.setCursor("dms", newest.id);
  return { read: true, linked, replied };
}

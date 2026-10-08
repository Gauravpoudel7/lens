import { isLinkedPro } from "./accounts.js";
import { errorMessage, log, newId } from "./ids.js";
import type { LensDeps } from "./pipeline.js";
import { publicSiteLabel, shortMint } from "./reply/policy.js";
import { safeSymbol } from "./reply/sanitize.js";
import type { CheckRecord } from "./types.js";


export function warningAlertText(
  check: Pick<CheckRecord, "tokenSymbol" | "tokenMint" | "id">,
  baseUrl: string,
  includeLinks = false,
  siteLabel: string | null = null,
): string {
  const symbol = safeSymbol(check.tokenSymbol, check.tokenMint);
  const who = check.tokenMint ? `$${symbol} (${shortMint(check.tokenMint)})` : `$${symbol}`;
  const closer = includeLinks
    ? `Report ${baseUrl}/r/${check.id}.`
    : siteLabel
      ? `Full report on ${siteLabel}.`
      : null;
  return [`Lens warning: ${who} is HIGH.`, closer, "Not financial advice."].filter(Boolean).join(" ");
}

export async function queueWarningAlerts(deps: LensDeps, check: CheckRecord): Promise<number> {
  if (check.riskLevel !== "HIGH") return 0;
  try {
    const now = new Date();
    const watchers = await deps.store.listProWatchers(check.tokenMint, now);
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const today = await deps.store.listAlertsSince(since);
    // One warning DM per watcher per mint per UTC day, plus the configured caps.
    const perUser = deps.config.alertDmsPerUserPerDay;
    const global = deps.config.alertDmsPerDay;
    if (today.length >= global) return 0;
    let sent = 0;
    for (const user of watchers) {
      if (today.length >= global) break;
      if (await deps.store.hasAlert(user.id, check.id)) continue;
      const forUser = today.filter((alert) => alert.userId === user.id);
      if (forUser.length >= perUser) continue;
      if (forUser.some((alert) => alert.mint === check.tokenMint)) continue;
      today.push({
        id: "",
        userId: user.id,
        checkId: check.id,
        mint: check.tokenMint,
        text: "",
        channel: "dm",
        status: "sent",
        xMessageId: null,
        createdAt: now.toISOString(),
      });
      const text = warningAlertText(
        check,
        deps.config.publicBaseUrl,
        deps.config.xReplyLinks,
        publicSiteLabel(deps.config),
      );
      // DMs go only to X accounts linked by DM code (they messaged us first). Others wait in the queue.
      if (!user.xUserId || !user.xLinkedAt) {
        await deps.store.saveAlert({
          id: newId(),
          userId: user.id,
          checkId: check.id,
          mint: check.tokenMint,
          text,
          channel: "dm",
          status: "queued",
          xMessageId: null,
          createdAt: new Date().toISOString(),
        });
        continue;
      }
      sent += await deliverAlert(deps, {
        userId: user.id,
        xUserId: user.xUserId,
        checkId: check.id,
        mint: check.tokenMint,
        text,
      });
    }
    return sent;
  } catch (err) {
    log("warning alerts failed", errorMessage(err));
    return 0;
  }
}

export async function flushQueuedAlerts(deps: LensDeps): Promise<number> {
  const queued = await deps.store.listAlertsByStatus("queued");
  let sent = 0;
  for (const alert of queued) {
    const user = await deps.store.getUser(alert.userId);
    if (!user?.xUserId || !isLinkedPro(user)) continue;
    try {
      const dm = await deps.x.sendDm({ recipientId: user.xUserId, text: alert.text });
      await deps.store.updateAlert(alert.id, { status: "sent", xMessageId: dm.id });
      sent += 1;
    } catch (err) {
      log("queued DM failed", errorMessage(err));
      await deps.store.updateAlert(alert.id, { status: "failed" });
    }
  }
  return sent;
}

async function deliverAlert(
  deps: LensDeps,
  input: { userId: string; xUserId: string; checkId: string; mint: string; text: string },
): Promise<number> {
  try {
    const dm = await deps.x.sendDm({ recipientId: input.xUserId, text: input.text });
    await deps.store.saveAlert({
      id: newId(),
      userId: input.userId,
      checkId: input.checkId,
      mint: input.mint,
      text: input.text,
      channel: "dm",
      status: "sent",
      xMessageId: dm.id,
      createdAt: new Date().toISOString(),
    });
    return 1;
  } catch (err) {
    await deps.store.saveAlert({
      id: newId(),
      userId: input.userId,
      checkId: input.checkId,
      mint: input.mint,
      text: input.text,
      channel: "dm",
      status: "failed",
      xMessageId: null,
      createdAt: new Date().toISOString(),
    });
    log("DM alert failed", errorMessage(err));
    return 0;
  }
}

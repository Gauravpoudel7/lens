import { errorMessage, log, logError, newId, utcDay } from "../ids.js";
import type { LensDeps } from "../pipeline.js";
import { buildProofPayload } from "../proof/hash.js";
import type { EditorialKind, EditorialRecord, EditorialStatus } from "../types.js";
import { composeTerm, composeTip } from "./compose.js";
import { listTrendingSolana, loadMarketRows } from "./discover.js";
import { buildActivityRecap, buildMarketRecap } from "./recap.js";
import { dueEditorial, inSlotWindow } from "./schedule.js";

export type EditorialOutcome = {
  kind: EditorialKind;
  status: EditorialStatus | "would_post" | "proof_failed";
  xPostId?: string | null;
  text?: string | null;
};

const CURSORS: Record<Exclude<EditorialKind, "recap">, string> = {
  tip: "editorial_tip_index",
  term: "editorial_term_index",
};
const MAX_ATTEMPTS = 3;
// ponytail: per-process memory so a repeated warning or "would post" logs once; a restart logs again.
const loggedOnce = new Set<string>();

/**
 * One editorial action per poll: retry a failed post, or prove and post the next due kind.
 * Proof comes first. A record left in "proved" is never posted again automatically.
 */
export async function runEditorialCycle(
  deps: LensDeps,
  now = new Date(),
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<EditorialOutcome | null> {
  const { config, store } = deps;
  if (!config.editorialEnabled) return null;
  const day = utcDay(now);
  const todays = await store.listEditorial({ day });

  if (config.xMode !== "live") {
    const kind = dueEditorial(now, config, todays);
    if (!kind) return null;
    const built = await buildText(deps, kind, now, { market: false });
    if (once(`would:${kind}:${day}`)) {
      log("editorial would post", { kind, text: built.text, reason: built.text ? undefined : built.reason });
    }
    return { kind, status: "would_post", text: built.text };
  }

  for (const row of todays) {
    if (row.status === "proved" && once(`proved:${row.id}`)) {
      logError("editorial proved but not marked posted; check X before posting it by hand", {
        kind: row.kind,
        day: row.day,
        id: row.id,
      });
    }
  }

  const retry = todays.find(
    (row) => row.status === "post_failed" && row.attempts < MAX_ATTEMPTS && inSlotWindow(row.kind, now, config),
  );
  if (retry) return postRecord(deps, retry);

  const kind = dueEditorial(now, config, todays);
  if (!kind) return null;
  const built = await buildText(deps, kind, now, {
    market: config.editorialMarketFallback,
    fetchImpl: opts.fetchImpl,
  });
  const stamp = now.toISOString();
  if (built.text === null) {
    await store.saveEditorial({
      ...emptyRecord(kind, day, stamp),
      status: "skipped",
      error: built.reason,
    });
    log("editorial skipped", { kind, reason: built.reason });
    return { kind, status: "skipped" };
  }

  const proof = buildProofPayload(built.text, now);
  let published: { signature: string; cluster: string };
  try {
    published = await deps.proofs.publish(proof.payload);
  } catch (err) {
    logError("editorial proof failed", { kind, detail: errorMessage(err) });
    return { kind, status: "proof_failed" };
  }
  const record: EditorialRecord = {
    ...emptyRecord(kind, day, stamp),
    text: built.text,
    contentHash: proof.hash,
    payload: proof.payload,
    txSignature: published.signature,
    cluster: published.cluster,
    status: "proved",
    recapSource: built.recapSource,
  };
  await store.saveEditorial(record);
  return postRecord(deps, record);
}

/** X answers a repeated text with 403 "duplicate content". */
export function isDuplicatePostError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const row = err as { code?: unknown; message?: unknown; data?: unknown };
  if (row.code !== 403) return false;
  const detail = `${typeof row.message === "string" ? row.message : ""} ${JSON.stringify(row.data ?? "")}`;
  return /duplicate/i.test(detail);
}

async function postRecord(deps: LensDeps, record: EditorialRecord): Promise<EditorialOutcome> {
  try {
    const posted = await deps.x.post(record.text);
    await deps.store.updateEditorial(record.id, { status: "posted", xPostId: posted.id, error: null });
    await advanceRotation(deps, record.kind);
    return { kind: record.kind, status: "posted", xPostId: posted.id };
  } catch (err) {
    const detail = errorMessage(err);
    if (isDuplicatePostError(err)) {
      await deps.store.updateEditorial(record.id, { status: "duplicate", error: detail });
      await advanceRotation(deps, record.kind);
      log("editorial duplicate", { kind: record.kind });
      return { kind: record.kind, status: "duplicate" };
    }
    const attempts = record.attempts + 1;
    await deps.store.updateEditorial(record.id, { status: "post_failed", error: detail, attempts });
    logError("editorial post failed", { kind: record.kind, attempts, detail });
    return { kind: record.kind, status: "post_failed" };
  }
}

async function advanceRotation(deps: LensDeps, kind: EditorialKind): Promise<void> {
  if (kind === "recap") return;
  await deps.store.setCursor(CURSORS[kind], String((await rotationIndex(deps, kind)) + 1));
}

export async function rotationIndex(deps: Pick<LensDeps, "store">, kind: Exclude<EditorialKind, "recap">): Promise<number> {
  const value = Number(await deps.store.getCursor(CURSORS[kind]));
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

type Built =
  | { text: string; recapSource: EditorialRecord["recapSource"]; reason?: undefined }
  | { text: null; recapSource: null; reason: string };

async function buildText(
  deps: LensDeps,
  kind: EditorialKind,
  now: Date,
  opts: { market: boolean; fetchImpl?: typeof fetch },
): Promise<Built> {
  if (kind === "tip") return { text: composeTip(await rotationIndex(deps, "tip")), recapSource: null };
  if (kind === "term") return { text: composeTerm(await rotationIndex(deps, "term")), recapSource: null };

  const checks = await deps.store.listChecksBetween(`${utcDay(now)}T00:00:00.000Z`, now.toISOString());
  const activity = buildActivityRecap(checks, deps.config.solanaCluster);
  if (activity) return { text: activity, recapSource: "activity" };
  if (!opts.market) {
    const reason = deps.config.editorialMarketFallback
      ? "fewer than 3 coins checked today; the market recap only runs in live X mode"
      : "fewer than 3 coins checked today and EDITORIAL_MARKET_FALLBACK=false";
    return { text: null, recapSource: null, reason };
  }
  // Mock fixture numbers must never be posted as mainnet facts.
  if (deps.provider.name === "mock") {
    return { text: null, recapSource: null, reason: "the market recap needs DATA_MODE=live" };
  }
  const coins = await listTrendingSolana(opts.fetchImpl);
  if (coins.length === 0) return { text: null, recapSource: null, reason: "trending pools could not be read" };
  const market = buildMarketRecap(await loadMarketRows(deps.provider, coins), now);
  if (!market) return { text: null, recapSource: null, reason: "fewer than 3 trending coins passed the data checks" };
  return { text: market, recapSource: "market" };
}

function emptyRecord(kind: EditorialKind, day: string, stamp: string): EditorialRecord {
  return {
    id: newId(),
    kind,
    day,
    text: "",
    contentHash: "",
    payload: "",
    txSignature: null,
    cluster: "",
    xPostId: null,
    status: "skipped",
    recapSource: null,
    error: null,
    attempts: 0,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function once(key: string): boolean {
  if (loggedOnce.has(key)) return false;
  loggedOnce.add(key);
  return true;
}

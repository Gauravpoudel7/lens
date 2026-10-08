import { randomBytes } from "node:crypto";
import { isActivePro, normalizeHandle, type LinkCodeRecord, type UserRecord } from "../accounts.js";
import { utcDay } from "../ids.js";
import { publicActionBaseUrl } from "../swap.js";
import type { LensConfig } from "../types.js";
import type { LensStore } from "../store/types.js";

/** Codes live this long. */
export const LINK_CODE_TTL_MS = 24 * 60 * 60 * 1000;
/** Wrong, expired, or someone else's codes from one X account per UTC day before its DMs are ignored. */
export const LINK_FAILURES_PER_DAY = 5;

// Crockford base32 without I, L, O, U: easy to read back and type.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_PATTERN = /\bLENS[\s-]*([0-9A-Z]{4})[\s-]*([0-9A-Z]{4})\b/i;

export function newLinkCode(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `LENS-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Finds `LENS-XXXX-XXXX` anywhere in a DM, ignoring case and stray spaces or dashes. */
export function parseLinkCode(text: string): string | null {
  const match = CODE_PATTERN.exec(text);
  return match ? `LENS-${match[1]!.toUpperCase()}-${match[2]!.toUpperCase()}` : null;
}

/**
 * The code for an active Pro account that has not linked X yet: the open one, or a new one.
 * Callers must have proved wallet ownership first; the code is the key to the account's X perks.
 */
export async function issueOrReuseLinkCode(
  store: LensStore,
  user: UserRecord,
  now = new Date(),
): Promise<LinkCodeRecord | null> {
  if (!isActivePro(user, now) || user.xLinkedAt) return null;
  const open = await store.activeLinkCode(user.id, now);
  if (open) return open;
  const record: LinkCodeRecord = {
    code: newLinkCode(),
    userId: user.id,
    expiresAt: new Date(now.getTime() + LINK_CODE_TTL_MS).toISOString(),
    usedAt: null,
    usedByXUserId: null,
    createdAt: now.toISOString(),
  };
  await store.saveLinkCode(record);
  return record;
}

export type LinkOutcome = "linked" | "already" | "wrong" | "expired" | "used" | "taken" | "not_pro" | "ignored";

export interface LinkDeps {
  store: LensStore;
  config: Pick<LensConfig, "publicBaseUrl">;
}

function accountPage(config: LinkDeps["config"]): string {
  const base = publicActionBaseUrl(config.publicBaseUrl);
  return base ? `at ${base}/account` : "on your Lens account page";
}

/**
 * Handles one DM. The only path that sets xUserId/xHandle/xLinkedAt on a paid account:
 * the X account that sent the code is the one that gets linked.
 */
export async function redeemLinkCode(
  deps: LinkDeps,
  input: { senderId: string; senderHandle: string; text: string; now?: Date },
): Promise<{ outcome: LinkOutcome; reply: string | null }> {
  const now = input.now ?? new Date();
  const handle = normalizeHandle(input.senderHandle);
  const failKey = `linkfail:${input.senderId}`;
  const day = utcDay(now);
  if ((await deps.store.getDailyCount(failKey, day)) >= LINK_FAILURES_PER_DAY) {
    return { outcome: "ignored", reply: null };
  }
  const code = parseLinkCode(input.text);
  if (!code) return { outcome: "ignored", reply: null };

  const fail = async (outcome: LinkOutcome, reply: string) => {
    await deps.store.incrementDailyCount(failKey, day);
    return { outcome, reply };
  };
  const taken = { outcome: "taken" as const, reply: "This X account is already linked to another Lens Pro wallet." };

  const row = await deps.store.getLinkCode(code);
  if (!row) return fail("wrong", `That code is not valid. Get a new one ${accountPage(deps.config)}.`);
  const target = await deps.store.getUser(row.userId);
  if (!target) return fail("wrong", `That code is not valid. Get a new one ${accountPage(deps.config)}.`);
  if (row.usedAt) {
    if (row.usedByXUserId === input.senderId && target.xUserId === input.senderId) {
      return { outcome: "already", reply: `Already linked. Lens Pro is on for @${target.xHandle ?? handle}.` };
    }
    return fail("used", "That code was already used.");
  }
  if (Date.parse(row.expiresAt) <= now.getTime()) {
    return fail("expired", `That code has expired. Get a new one ${accountPage(deps.config)}.`);
  }
  if (!isActivePro(target, now)) return { outcome: "not_pro", reply: "That plan is not active." };
  if (target.xLinkedAt && target.xUserId !== input.senderId) return taken;

  // Accounts that already hold this X id or handle. A wallet-less, unlinked one is an old Free/handle
  // record for this person and is folded in. Anything with a wallet or a link belongs to someone else.
  const byId = await deps.store.findUser({ xUserId: input.senderId });
  const byHandle = handle ? await deps.store.findUser({ xHandle: handle }) : null;
  let absorb: UserRecord | null = null;
  for (const other of [byId, byHandle]) {
    if (!other || other.id === target.id || other.id === absorb?.id) continue;
    if (other.wallet || other.xLinkedAt || (other.xUserId && other.xUserId !== input.senderId) || absorb) return taken;
    absorb = other;
  }

  const linked = await deps.store.linkXAccount({
    userId: target.id,
    xUserId: input.senderId,
    xHandle: handle,
    code,
    now,
    absorbUserId: absorb?.id ?? null,
  });
  return { outcome: "linked", reply: `Linked. Lens Pro is on for @${linked.xHandle}.` };
}

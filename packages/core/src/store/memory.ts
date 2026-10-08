import { newId } from "../ids.js";
import { isActivePro, normalizeHandle, type AlertRecord, type PaymentRecord, type UserRecord, type WatchRecord } from "../accounts.js";
import type { CheckRecord, MentionRecord, OutcomeRecord } from "../types.js";
import type { LensStore } from "./types.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryStore implements LensStore {
  mentions = new Map<string, MentionRecord>();
  checks = new Map<string, CheckRecord>();
  replies = new Map<string, { mentionId: string; checkId: string; text: string; cached: boolean; xReplyId: string | null }>();
  usage = new Map<string, number>();
  memos = new Map<string, { payload: string; cluster: string }>();
  cursors = new Map<string, string>();
  users = new Map<string, UserRecord>();
  watches = new Map<string, WatchRecord>();
  payments = new Map<string, PaymentRecord>();
  alerts = new Map<string, AlertRecord>();
  outbound = new Map<string, number>();

  async getMention(id: string): Promise<MentionRecord | null> {
    const mention = this.mentions.get(id);
    return mention ? clone(mention) : null;
  }

  async saveMention(mention: Omit<MentionRecord, "createdAt"> & { createdAt?: string }): Promise<void> {
    this.mentions.set(mention.id, {
      ...mention,
      createdAt: mention.createdAt ?? new Date().toISOString(),
    });
  }

  async updateMention(
    id: string,
    patch: Partial<Pick<MentionRecord, "status" | "skipReason" | "checkId" | "parentText">>,
  ): Promise<void> {
    const current = this.mentions.get(id);
    if (!current) throw new Error(`Unknown mention ${id}`);
    this.mentions.set(id, { ...current, ...patch });
  }

  async saveCheck(check: CheckRecord): Promise<void> {
    this.checks.set(check.id, clone(check));
  }

  async getCheck(id: string): Promise<CheckRecord | null> {
    const check = this.checks.get(id);
    return check ? clone(check) : null;
  }

  async updateCheck(
    id: string,
    patch: Partial<Pick<CheckRecord, "status" | "error" | "xPostId">>,
  ): Promise<void> {
    const current = this.checks.get(id);
    if (!current) throw new Error(`Unknown check ${id}`);
    this.checks.set(id, { ...current, ...patch });
  }

  async listChecks(opts?: { limit?: number; kinds?: CheckRecord["kind"][] }): Promise<CheckRecord[]> {
    const limit = opts?.limit ?? 500;
    const kinds = opts?.kinds ? new Set(opts.kinds) : null;
    return [...this.checks.values()]
      .filter((check) => !kinds || kinds.has(check.kind))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit)
      .map(clone);
  }

  async findReusableCheck(parentPostId: string, mint: string): Promise<CheckRecord | null> {
    const found = [...this.checks.values()]
      .filter(
        (check) =>
          check.parentPostId === parentPostId &&
          check.tokenMint === mint &&
          (check.status === "published" || check.status === "reply_failed") &&
          check.replyText.length > 0 &&
          check.proof?.txSignature,
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    return found ? clone(found) : null;
  }

  async latestCheckForMint(mint: string, maxAgeMs: number, now = new Date()): Promise<CheckRecord | null> {
    const cutoff = now.getTime() - maxAgeMs;
    const found = [...this.checks.values()]
      .filter(
        (check) =>
          check.tokenMint === mint &&
          (check.status === "published" || check.status === "reply_failed") &&
          Date.parse(check.createdAt) >= cutoff,
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    return found ? clone(found) : null;
  }

  async saveReply(reply: {
    id: string;
    mentionId: string;
    checkId: string;
    xReplyId: string | null;
    text: string;
    cached: boolean;
  }): Promise<void> {
    this.replies.set(reply.id, reply);
  }

  async hasReplyForMention(mentionId: string): Promise<boolean> {
    for (const reply of this.replies.values()) {
      if (reply.mentionId === mentionId) return true;
    }
    return false;
  }

  async getPostedReply(mentionId: string): Promise<{ checkId: string; xReplyId: string } | null> {
    for (const reply of this.replies.values()) {
      if (reply.mentionId === mentionId && reply.xReplyId) {
        return { checkId: reply.checkId, xReplyId: reply.xReplyId };
      }
    }
    return null;
  }

  async getDailyCount(userId: string, day: string): Promise<number> {
    return this.usage.get(`${userId}:${day}`) ?? 0;
  }

  async incrementDailyCount(userId: string, day: string): Promise<number> {
    const key = `${userId}:${day}`;
    const next = (this.usage.get(key) ?? 0) + 1;
    this.usage.set(key, next);
    return next;
  }

  async listUnscored(createdBeforeIso: string): Promise<CheckRecord[]> {
    return [...this.checks.values()]
      .filter(
        (check) =>
          !check.outcome &&
          (check.status === "published" || check.status === "reply_failed") &&
          check.tokenMint !== "" &&
          check.riskLevel !== "NONE" &&
          check.createdAt <= createdBeforeIso,
      )
      .map(clone);
  }

  async saveOutcome(checkId: string, outcome: OutcomeRecord): Promise<void> {
    const current = this.checks.get(checkId);
    if (!current) throw new Error(`Unknown check ${checkId}`);
    this.checks.set(checkId, { ...current, outcome: clone(outcome) });
  }

  async saveChainMemo(signature: string, payload: string, cluster: string): Promise<void> {
    this.memos.set(signature, { payload, cluster });
  }

  async getChainMemo(signature: string): Promise<{ payload: string; cluster: string } | null> {
    return this.memos.get(signature) ?? null;
  }

  async getCursor(id: string): Promise<string | null> {
    return this.cursors.get(id) ?? null;
  }

  async setCursor(id: string, sinceId: string): Promise<void> {
    this.cursors.set(id, sinceId);
  }

  async upsertUser(input: {
    xUserId?: string | null;
    xHandle?: string | null;
    wallet?: string | null;
  }): Promise<UserRecord> {
    const xUserId = input.xUserId?.trim() || null;
    const xHandle = input.xHandle ? normalizeHandle(input.xHandle) : null;
    const wallet = input.wallet?.trim() || null;
    const existing =
      (xUserId ? [...this.users.values()].find((user) => user.xUserId === xUserId) : undefined) ??
      (xHandle ? [...this.users.values()].find((user) => user.xHandle === xHandle) : undefined) ??
      (wallet ? [...this.users.values()].find((user) => user.wallet === wallet) : undefined);
    const next: UserRecord = existing
      ? {
          ...existing,
          xUserId: xUserId ?? existing.xUserId,
          xHandle: xHandle ?? existing.xHandle,
          wallet: wallet ?? existing.wallet,
        }
      : {
          id: newId(),
          xUserId,
          xHandle,
          wallet,
          tier: "free",
          proUntil: null,
          createdAt: new Date().toISOString(),
        };
    this.users.set(next.id, next);
    return clone(next);
  }

  async findUser(query: {
    xUserId?: string | null;
    xHandle?: string | null;
    wallet?: string | null;
  }): Promise<UserRecord | null> {
    const xUserId = query.xUserId?.trim() || null;
    const xHandle = query.xHandle ? normalizeHandle(query.xHandle) : null;
    const wallet = query.wallet?.trim() || null;
    const found =
      (xUserId ? [...this.users.values()].find((user) => user.xUserId === xUserId) : undefined) ??
      (xHandle ? [...this.users.values()].find((user) => user.xHandle === xHandle) : undefined) ??
      (wallet ? [...this.users.values()].find((user) => user.wallet === wallet) : undefined);
    return found ? clone(found) : null;
  }

  async getUser(id: string): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? clone(user) : null;
  }

  async setProUntil(userId: string, proUntilIso: string): Promise<UserRecord> {
    const current = this.users.get(userId);
    if (!current) throw new Error(`Unknown user ${userId}`);
    const next = { ...current, tier: "pro" as const, proUntil: proUntilIso };
    this.users.set(userId, next);
    return clone(next);
  }

  async listWatches(userId: string): Promise<WatchRecord[]> {
    return [...this.watches.values()].filter((watch) => watch.userId === userId).map(clone);
  }

  async addWatch(userId: string, mint: string, symbol: string): Promise<WatchRecord> {
    const existing = [...this.watches.values()].find((watch) => watch.userId === userId && watch.mint === mint);
    if (existing) return clone(existing);
    const watch: WatchRecord = {
      id: newId(),
      userId,
      mint,
      symbol,
      createdAt: new Date().toISOString(),
    };
    this.watches.set(watch.id, watch);
    return clone(watch);
  }

  async removeWatch(userId: string, mint: string): Promise<void> {
    for (const [id, watch] of this.watches) {
      if (watch.userId === userId && watch.mint === mint) this.watches.delete(id);
    }
  }

  async listProWatchers(mint: string, now: Date): Promise<UserRecord[]> {
    const userIds = new Set(
      [...this.watches.values()].filter((watch) => watch.mint === mint).map((watch) => watch.userId),
    );
    return [...this.users.values()]
      .filter((user) => userIds.has(user.id) && isActivePro(user, now))
      .map(clone);
  }

  async savePayment(payment: PaymentRecord): Promise<void> {
    this.payments.set(payment.id, clone(payment));
  }

  async getPaymentByReference(reference: string): Promise<PaymentRecord | null> {
    const found = [...this.payments.values()].find((payment) => payment.reference === reference);
    return found ? clone(found) : null;
  }

  async findPaymentBySignature(signature: string): Promise<PaymentRecord | null> {
    if (!signature) return null;
    const found = [...this.payments.values()].find((payment) => payment.signature === signature);
    return found ? clone(found) : null;
  }

  async updatePayment(
    id: string,
    patch: Partial<Pick<PaymentRecord, "status" | "signature">>,
  ): Promise<void> {
    const current = this.payments.get(id);
    if (!current) throw new Error(`Unknown payment ${id}`);
    this.payments.set(id, { ...current, ...patch });
  }

  async saveAlert(alert: AlertRecord): Promise<void> {
    this.alerts.set(alert.id, clone(alert));
  }

  async hasAlert(userId: string, checkId: string): Promise<boolean> {
    return [...this.alerts.values()].some((alert) => alert.userId === userId && alert.checkId === checkId);
  }

  async listAlertsByStatus(status: AlertRecord["status"]): Promise<AlertRecord[]> {
    return [...this.alerts.values()].filter((alert) => alert.status === status).map(clone);
  }

  async listAlertsSince(sinceIso: string): Promise<AlertRecord[]> {
    const since = Date.parse(sinceIso);
    return [...this.alerts.values()]
      .filter((alert) => Date.parse(alert.createdAt) >= since)
      .map(clone);
  }

  async updateAlert(
    id: string,
    patch: Partial<Pick<AlertRecord, "status" | "xMessageId">>,
  ): Promise<void> {
    const current = this.alerts.get(id);
    if (!current) throw new Error(`Unknown alert ${id}`);
    this.alerts.set(id, { ...current, ...patch });
  }

  async getOutboundCount(day: string): Promise<number> {
    return this.outbound.get(day) ?? 0;
  }

  async incrementOutboundCount(day: string): Promise<number> {
    const next = (this.outbound.get(day) ?? 0) + 1;
    this.outbound.set(day, next);
    return next;
  }
}

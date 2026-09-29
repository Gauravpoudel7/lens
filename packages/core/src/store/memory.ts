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

  async listChecks(opts?: { limit?: number }): Promise<CheckRecord[]> {
    const limit = opts?.limit ?? 500;
    return [...this.checks.values()]
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
}

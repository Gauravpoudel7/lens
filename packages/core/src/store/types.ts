import type { CheckRecord, MentionRecord, OutcomeRecord } from "../types.js";

export interface LensStore {
  getMention(id: string): Promise<MentionRecord | null>;
  saveMention(mention: Omit<MentionRecord, "createdAt"> & { createdAt?: string }): Promise<void>;
  updateMention(
    id: string,
    patch: Partial<Pick<MentionRecord, "status" | "skipReason" | "checkId" | "parentText">>,
  ): Promise<void>;

  saveCheck(check: CheckRecord): Promise<void>;
  getCheck(id: string): Promise<CheckRecord | null>;
  updateCheck(
    id: string,
    patch: Partial<Pick<CheckRecord, "status" | "error" | "xPostId">>,
  ): Promise<void>;
  listChecks(opts?: { limit?: number }): Promise<CheckRecord[]>;
  findReusableCheck(parentPostId: string, mint: string): Promise<CheckRecord | null>;
  latestCheckForMint(mint: string, maxAgeMs: number, now?: Date): Promise<CheckRecord | null>;

  saveReply(reply: {
    id: string;
    mentionId: string;
    checkId: string;
    xReplyId: string | null;
    text: string;
    cached: boolean;
  }): Promise<void>;
  hasReplyForMention(mentionId: string): Promise<boolean>;

  getDailyCount(userId: string, day: string): Promise<number>;
  incrementDailyCount(userId: string, day: string): Promise<number>;

  listUnscored(createdBeforeIso: string): Promise<CheckRecord[]>;
  saveOutcome(checkId: string, outcome: OutcomeRecord): Promise<void>;

  saveChainMemo(signature: string, payload: string, cluster: string): Promise<void>;
  getChainMemo(signature: string): Promise<{ payload: string; cluster: string } | null>;

  getCursor(id: string): Promise<string | null>;
  setCursor(id: string, sinceId: string): Promise<void>;
}

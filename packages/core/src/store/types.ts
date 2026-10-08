import type { AlertRecord, LinkCodeRecord, PaymentRecord, UserRecord, WatchRecord } from "../accounts.js";
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
  listChecks(opts?: { limit?: number; kinds?: CheckRecord["kind"][] }): Promise<CheckRecord[]>;
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
  getPostedReply(mentionId: string): Promise<{ checkId: string; xReplyId: string } | null>;

  getDailyCount(userId: string, day: string): Promise<number>;
  incrementDailyCount(userId: string, day: string): Promise<number>;

  listUnscored(createdBeforeIso: string): Promise<CheckRecord[]>;
  saveOutcome(checkId: string, outcome: OutcomeRecord): Promise<void>;

  saveChainMemo(signature: string, payload: string, cluster: string): Promise<void>;
  getChainMemo(signature: string): Promise<{ payload: string; cluster: string } | null>;

  getCursor(id: string): Promise<string | null>;
  setCursor(id: string, sinceId: string): Promise<void>;

  upsertUser(input: {
    xUserId?: string | null;
    xHandle?: string | null;
    wallet?: string | null;
  }): Promise<UserRecord>;
  findUser(query: {
    xUserId?: string | null;
    xHandle?: string | null;
    wallet?: string | null;
  }): Promise<UserRecord | null>;
  getUser(id: string): Promise<UserRecord | null>;
  setProUntil(userId: string, proUntilIso: string): Promise<UserRecord>;

  saveLinkCode(code: LinkCodeRecord): Promise<void>;
  getLinkCode(code: string): Promise<LinkCodeRecord | null>;
  /** Newest unused, unexpired code for this account. */
  activeLinkCode(userId: string, now: Date): Promise<LinkCodeRecord | null>;
  /** Oldest unused, unexpired code across all accounts, or null. Gates DM polling. */
  oldestOpenLinkCode(now: Date): Promise<LinkCodeRecord | null>;
  /**
   * Atomically: mark the code used by `xUserId`, optionally fold `absorbUserId` (a wallet-less account
   * holding this handle) into `userId`, then set xUserId, xHandle and xLinkedAt on `userId`.
   */
  linkXAccount(input: {
    userId: string;
    xUserId: string;
    xHandle: string;
    code: string;
    now: Date;
    absorbUserId?: string | null;
  }): Promise<UserRecord>;

  listWatches(userId: string): Promise<WatchRecord[]>;
  addWatch(userId: string, mint: string, symbol: string): Promise<WatchRecord>;
  removeWatch(userId: string, mint: string): Promise<void>;
  listProWatchers(mint: string, now: Date): Promise<UserRecord[]>;

  savePayment(payment: PaymentRecord): Promise<void>;
  getPaymentByReference(reference: string): Promise<PaymentRecord | null>;
  findPaymentBySignature(signature: string): Promise<PaymentRecord | null>;
  updatePayment(
    id: string,
    patch: Partial<Pick<PaymentRecord, "status" | "signature">>,
  ): Promise<void>;

  saveAlert(alert: AlertRecord): Promise<void>;
  hasAlert(userId: string, checkId: string): Promise<boolean>;
  listAlertsByStatus(status: AlertRecord["status"]): Promise<AlertRecord[]>;
  listAlertsSince(sinceIso: string): Promise<AlertRecord[]>;
  updateAlert(
    id: string,
    patch: Partial<Pick<AlertRecord, "status" | "xMessageId">>,
  ): Promise<void>;

  getOutboundCount(day: string): Promise<number>;
  incrementOutboundCount(day: string): Promise<number>;
}

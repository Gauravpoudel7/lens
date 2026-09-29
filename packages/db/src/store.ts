import {
  newId,
  normalizeHandle,
  type AlertRecord,
  type CheckRecord,
  type Fact,
  type LensStore,
  type MentionRecord,
  type OutcomeRecord,
  type PaymentRecord,
  type TokenSnapshot,
  type UserRecord,
  type WatchRecord,
} from "@lens/core";
import { getPrisma } from "./client.js";

type CheckRow = {
  id: string;
  kind: string;
  mentionId: string | null;
  parentPostId: string | null;
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  riskLevel: string;
  score: number;
  dangerCount: number;
  cautionCount: number;
  unknownCount: number;
  factsJson: string;
  snapshotJson: string;
  claimsJson: string;
  sourcesJson: string;
  dataMode: string;
  replyText: string;
  sourcePostText: string | null;
  priceAtCheck: number | null;
  askedBy: string | null;
  status: string;
  error: string | null;
  xPostId: string | null;
  createdAt: Date;
  proof: {
    contentHash: string;
    signedAt: Date;
    payload: string;
    txSignature: string | null;
    cluster: string;
    status: string;
    explorerUrl: string | null;
  } | null;
  outcome: {
    priceAtCheck: number | null;
    priceAtScore: number | null;
    priceChangePct: number | null;
    windowDays: number;
    labelCorrect: boolean | null;
    callResult: string;
    scoredAt: Date;
  } | null;
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toCheck(row: CheckRow): CheckRecord {
  return {
    id: row.id,
    kind: row.kind as CheckRecord["kind"],
    mentionId: row.mentionId,
    parentPostId: row.parentPostId,
    tokenMint: row.tokenMint,
    tokenSymbol: row.tokenSymbol,
    tokenName: row.tokenName,
    riskLevel: row.riskLevel as CheckRecord["riskLevel"],
    score: row.score,
    dangerCount: row.dangerCount,
    cautionCount: row.cautionCount,
    unknownCount: row.unknownCount,
    facts: parseJson<Fact[]>(row.factsJson, []),
    snapshot: parseJson<TokenSnapshot | null>(row.snapshotJson, null),
    claims: parseJson(row.claimsJson, { burned: false, locked: false }),
    sources: parseJson<string[]>(row.sourcesJson, []),
    dataMode: row.dataMode === "live" ? "live" : "mock",
    replyText: row.replyText,
    sourcePostText: row.sourcePostText,
    priceAtCheck: row.priceAtCheck,
    askedBy: row.askedBy,
    status: row.status as CheckRecord["status"],
    error: row.error,
    xPostId: row.xPostId,
    createdAt: row.createdAt.toISOString(),
    proof: row.proof
      ? {
          contentHash: row.proof.contentHash,
          signedAt: row.proof.signedAt.toISOString(),
          payload: row.proof.payload,
          txSignature: row.proof.txSignature,
          cluster: row.proof.cluster,
          status: row.proof.status as "confirmed" | "mocked" | "failed",
          explorerUrl: row.proof.explorerUrl,
        }
      : null,
    outcome: row.outcome
      ? {
          priceAtCheck: row.outcome.priceAtCheck,
          priceAtScore: row.outcome.priceAtScore,
          priceChangePct: row.outcome.priceChangePct,
          windowDays: row.outcome.windowDays,
          labelCorrect: row.outcome.labelCorrect,
          callResult: row.outcome.callResult as OutcomeRecord["callResult"],
          scoredAt: row.outcome.scoredAt.toISOString(),
        }
      : null,
  };
}

const include = { proof: true, outcome: true } as const;

export function createPrismaStore(): LensStore {
  const prisma = getPrisma();
  return {
    async getMention(id) {
      const row = await prisma.mention.findUnique({ where: { id } });
      if (!row) return null;
      return {
        id: row.id,
        xUserId: row.xUserId,
        xUsername: row.xUsername,
        parentPostId: row.parentPostId,
        text: row.text,
        parentText: row.parentText,
        status: row.status as MentionRecord["status"],
        skipReason: row.skipReason,
        checkId: row.checkId,
        createdAt: row.createdAt.toISOString(),
      };
    },
    async saveMention(mention) {
      await prisma.mention.create({
        data: {
          id: mention.id,
          xUserId: mention.xUserId,
          xUsername: mention.xUsername,
          parentPostId: mention.parentPostId,
          text: mention.text,
          parentText: mention.parentText,
          status: mention.status,
          skipReason: mention.skipReason,
          checkId: mention.checkId,
          createdAt: mention.createdAt ? new Date(mention.createdAt) : undefined,
        },
      });
    },
    async updateMention(id, patch) {
      await prisma.mention.update({ where: { id }, data: patch });
    },
    async saveCheck(check) {
      await prisma.check.create({
        data: {
          id: check.id,
          kind: check.kind,
          mentionId: check.mentionId,
          parentPostId: check.parentPostId,
          tokenMint: check.tokenMint,
          tokenSymbol: check.tokenSymbol,
          tokenName: check.tokenName,
          riskLevel: check.riskLevel,
          score: check.score,
          dangerCount: check.dangerCount,
          cautionCount: check.cautionCount,
          unknownCount: check.unknownCount,
          factsJson: JSON.stringify(check.facts),
          snapshotJson: JSON.stringify(check.snapshot),
          claimsJson: JSON.stringify(check.claims),
          sourcesJson: JSON.stringify(check.sources),
          dataMode: check.dataMode,
          replyText: check.replyText,
          sourcePostText: check.sourcePostText,
          priceAtCheck: check.priceAtCheck,
          askedBy: check.askedBy,
          status: check.status,
          error: check.error,
          xPostId: check.xPostId,
          createdAt: new Date(check.createdAt),
          proof: check.proof
            ? {
                create: {
                  id: newId(),
                  contentHash: check.proof.contentHash,
                  signedAt: new Date(check.proof.signedAt),
                  payload: check.proof.payload,
                  txSignature: check.proof.txSignature,
                  cluster: check.proof.cluster,
                  status: check.proof.status,
                  explorerUrl: check.proof.explorerUrl,
                },
              }
            : undefined,
        },
      });
    },
    async getCheck(id) {
      const row = await prisma.check.findUnique({ where: { id }, include });
      return row ? toCheck(row) : null;
    },
    async updateCheck(id, patch) {
      await prisma.check.update({ where: { id }, data: patch });
    },
    async listChecks(opts) {
      const rows = await prisma.check.findMany({
        include,
        orderBy: { createdAt: "desc" },
        take: opts?.limit ?? 500,
      });
      return rows.map(toCheck);
    },
    async findReusableCheck(parentPostId, mint) {
      const row = await prisma.check.findFirst({
        where: {
          parentPostId,
          tokenMint: mint,
          status: { in: ["published", "reply_failed"] },
          proof: { isNot: null },
        },
        include,
        orderBy: { createdAt: "desc" },
      });
      if (!row || !row.replyText || !row.proof?.txSignature) return null;
      return toCheck(row);
    },
    async latestCheckForMint(mint, maxAgeMs, now = new Date()) {
      const row = await prisma.check.findFirst({
        where: {
          tokenMint: mint,
          status: { in: ["published", "reply_failed"] },
          createdAt: { gte: new Date(now.getTime() - maxAgeMs) },
        },
        include,
        orderBy: { createdAt: "desc" },
      });
      return row ? toCheck(row) : null;
    },
    async saveReply(reply) {
      await prisma.reply.create({
        data: {
          id: reply.id,
          mentionId: reply.mentionId,
          checkId: reply.checkId,
          xReplyId: reply.xReplyId,
          text: reply.text,
          cached: reply.cached,
        },
      });
    },
    async hasReplyForMention(mentionId) {
      const count = await prisma.reply.count({ where: { mentionId } });
      return count > 0;
    },
    async getDailyCount(userId, day) {
      const row = await prisma.usageDay.findUnique({ where: { xUserId_day: { xUserId: userId, day } } });
      return row?.count ?? 0;
    },
    async incrementDailyCount(userId, day) {
      const row = await prisma.usageDay.upsert({
        where: { xUserId_day: { xUserId: userId, day } },
        create: { id: newId(), xUserId: userId, day, count: 1 },
        update: { count: { increment: 1 } },
      });
      return row.count;
    },
    async listUnscored(createdBeforeIso) {
      const rows = await prisma.check.findMany({
        where: {
          outcome: null,
          status: { in: ["published", "reply_failed"] },
          createdAt: { lte: new Date(createdBeforeIso) },
          tokenMint: { not: "" },
          riskLevel: { not: "NONE" },
        },
        include,
        orderBy: { createdAt: "asc" },
      });
      return rows.map(toCheck);
    },
    async saveOutcome(checkId, outcome) {
      await prisma.outcome.create({
        data: {
          id: newId(),
          checkId,
          priceAtCheck: outcome.priceAtCheck,
          priceAtScore: outcome.priceAtScore,
          priceChangePct: outcome.priceChangePct,
          windowDays: outcome.windowDays,
          labelCorrect: outcome.labelCorrect,
          callResult: outcome.callResult,
          scoredAt: new Date(outcome.scoredAt),
        },
      });
    },
    async saveChainMemo(signature, payload, cluster) {
      await prisma.chainMemo.upsert({
        where: { signature },
        create: { signature, payload, cluster },
        update: { payload, cluster },
      });
    },
    async getChainMemo(signature) {
      const row = await prisma.chainMemo.findUnique({ where: { signature } });
      return row ? { payload: row.payload, cluster: row.cluster } : null;
    },
    async getCursor(id) {
      const row = await prisma.botCursor.findUnique({ where: { id } });
      return row?.sinceId ?? null;
    },
    async setCursor(id, sinceId) {
      await prisma.botCursor.upsert({
        where: { id },
        create: { id, sinceId },
        update: { sinceId },
      });
    },
    async upsertUser(input) {
      const xUserId = input.xUserId?.trim() || null;
      const xHandle = input.xHandle ? normalizeHandle(input.xHandle) : null;
      const wallet = input.wallet?.trim() || null;
      const existing =
        (xUserId ? await prisma.account.findUnique({ where: { xUserId } }) : null) ??
        (xHandle ? await prisma.account.findUnique({ where: { xHandle } }) : null) ??
        (wallet ? await prisma.account.findUnique({ where: { wallet } }) : null);
      if (!existing) {
        const created = await prisma.account.create({
          data: { id: newId(), xUserId, xHandle, wallet, tier: "free" },
        });
        return toUser(created);
      }
      const updated = await prisma.account.update({
        where: { id: existing.id },
        data: {
          xUserId: xUserId ?? existing.xUserId,
          xHandle: xHandle ?? existing.xHandle,
          wallet: wallet ?? existing.wallet,
        },
      });
      return toUser(updated);
    },
    async findUser(query) {
      const xUserId = query.xUserId?.trim() || null;
      const xHandle = query.xHandle ? normalizeHandle(query.xHandle) : null;
      const wallet = query.wallet?.trim() || null;
      const row =
        (xUserId ? await prisma.account.findUnique({ where: { xUserId } }) : null) ??
        (xHandle ? await prisma.account.findUnique({ where: { xHandle } }) : null) ??
        (wallet ? await prisma.account.findUnique({ where: { wallet } }) : null);
      return row ? toUser(row) : null;
    },
    async getUser(id) {
      const row = await prisma.account.findUnique({ where: { id } });
      return row ? toUser(row) : null;
    },
    async setProUntil(userId, proUntilIso) {
      const row = await prisma.account.update({
        where: { id: userId },
        data: { tier: "pro", proUntil: new Date(proUntilIso) },
      });
      return toUser(row);
    },
    async listWatches(userId) {
      const rows = await prisma.watch.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
      return rows.map(toWatch);
    },
    async addWatch(userId, mint, symbol) {
      const existing = await prisma.watch.findUnique({ where: { userId_mint: { userId, mint } } });
      if (existing) return toWatch(existing);
      const row = await prisma.watch.create({ data: { id: newId(), userId, mint, symbol } });
      return toWatch(row);
    },
    async removeWatch(userId, mint) {
      await prisma.watch.deleteMany({ where: { userId, mint } });
    },
    async listProWatchers(mint, now) {
      const rows = await prisma.watch.findMany({
        where: { mint, user: { proUntil: { gt: now } } },
        include: { user: true },
      });
      return rows.map((row) => toUser(row.user));
    },
    async savePayment(payment) {
      await prisma.payment.create({
        data: {
          id: payment.id,
          userId: payment.userId,
          provider: payment.provider,
          reference: payment.reference,
          amountUsd: payment.amountUsd,
          amountRaw: payment.amountRaw,
          mint: payment.mint,
          recipient: payment.recipient,
          signature: payment.signature,
          status: payment.status,
          createdAt: new Date(payment.createdAt),
        },
      });
    },
    async getPaymentByReference(reference) {
      const row = await prisma.payment.findUnique({ where: { reference } });
      return row ? toPayment(row) : null;
    },
    async updatePayment(id, patch) {
      await prisma.payment.update({ where: { id }, data: patch });
    },
    async saveAlert(alert) {
      await prisma.alert.create({
        data: {
          id: alert.id,
          userId: alert.userId,
          checkId: alert.checkId,
          mint: alert.mint,
          text: alert.text,
          channel: alert.channel,
          status: alert.status,
          xMessageId: alert.xMessageId,
          createdAt: new Date(alert.createdAt),
        },
      });
    },
    async hasAlert(userId, checkId) {
      const count = await prisma.alert.count({ where: { userId, checkId } });
      return count > 0;
    },
    async listAlertsByStatus(status) {
      const rows = await prisma.alert.findMany({ where: { status }, orderBy: { createdAt: "asc" } });
      return rows.map(toAlert);
    },
    async updateAlert(id, patch) {
      await prisma.alert.update({ where: { id }, data: patch });
    },
    async getOutboundCount(day) {
      const row = await prisma.outboundDay.findUnique({ where: { day } });
      return row?.count ?? 0;
    },
    async incrementOutboundCount(day) {
      const row = await prisma.outboundDay.upsert({
        where: { day },
        create: { day, count: 1 },
        update: { count: { increment: 1 } },
      });
      return row.count;
    },
  };
}

function toUser(row: {
  id: string;
  xUserId: string | null;
  xHandle: string | null;
  wallet: string | null;
  tier: string;
  proUntil: Date | null;
  createdAt: Date;
}): UserRecord {
  return {
    id: row.id,
    xUserId: row.xUserId,
    xHandle: row.xHandle,
    wallet: row.wallet,
    tier: row.tier === "pro" ? "pro" : "free",
    proUntil: row.proUntil ? row.proUntil.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toWatch(row: { id: string; userId: string; mint: string; symbol: string; createdAt: Date }): WatchRecord {
  return {
    id: row.id,
    userId: row.userId,
    mint: row.mint,
    symbol: row.symbol,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPayment(row: {
  id: string;
  userId: string;
  provider: string;
  reference: string;
  amountUsd: number;
  amountRaw: string;
  mint: string;
  recipient: string;
  signature: string | null;
  status: string;
  createdAt: Date;
}): PaymentRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider === "card" ? "card" : "solana_usdc",
    reference: row.reference,
    amountUsd: row.amountUsd,
    amountRaw: row.amountRaw,
    mint: row.mint,
    recipient: row.recipient,
    signature: row.signature,
    status: row.status === "paid" || row.status === "failed" ? row.status : "pending",
    createdAt: row.createdAt.toISOString(),
  };
}

function toAlert(row: {
  id: string;
  userId: string;
  checkId: string;
  mint: string;
  text: string;
  channel: string;
  status: string;
  xMessageId: string | null;
  createdAt: Date;
}): AlertRecord {
  return {
    id: row.id,
    userId: row.userId,
    checkId: row.checkId,
    mint: row.mint,
    text: row.text,
    channel: "dm",
    status: row.status === "sent" || row.status === "failed" ? row.status : "queued",
    xMessageId: row.xMessageId,
    createdAt: row.createdAt.toISOString(),
  };
}

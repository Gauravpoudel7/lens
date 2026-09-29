import { newId, type CheckRecord, type Fact, type LensStore, type MentionRecord, type OutcomeRecord, type TokenSnapshot } from "@lens/core";
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
  };
}

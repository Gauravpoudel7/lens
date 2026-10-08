import { isActivePro } from "./accounts.js";
import { queueWarningAlerts } from "./alerts.js";
import { claimsFromPosts } from "./claims.js";
import { listDexCandidates, type TokenCandidate } from "./discover.js";
import { errorMessage, log, newId, utcDay } from "./ids.js";
import { evaluateRisk, levelSummary, snapshotToRuleInput } from "./risk/engine.js";
import { assertSafeNotice, UNRESOLVED_REPLY } from "./reply/policy.js";
import { safeSymbol, scrubThirdPartyText } from "./reply/sanitize.js";
import type { ReplyWriter } from "./reply/writer.js";
import { buildProofPayload, explorerTxUrl } from "./proof/hash.js";
import type { ProofPublisher } from "./proof/solana.js";
import type { TokenDataProvider } from "./providers/types.js";
import { resolveToken } from "./resolver.js";
import { decideSwapLink, replyHasSwapLink, wantsTradeLink } from "./swap.js";
import type { LensStore } from "./store/types.js";
import type {
  CheckKind,
  CheckRecord,
  Claims,
  LensConfig,
  MentionRecord,
  ProofRecord,
  RiskLevel,
  TokenSnapshot,
} from "./types.js";
import type { XClient } from "./x/types.js";

export interface LensDeps {
  config: LensConfig;
  store: LensStore;
  provider: TokenDataProvider;
  proofs: ProofPublisher;
  writer: ReplyWriter;
  x: XClient;
}

export interface IncomingMention {
  id: string;
  authorId: string;
  authorUsername: string;
  text: string;
  parentId?: string | null;
  parentText?: string | null;
  createdAt?: string;
}

export type ProcessResult =
  | { status: "replied"; checkId: string; cached: boolean; replyText: string; riskLevel: string }
  | { status: "already_done"; checkId: string | null }
  | { status: "rate_limited"; checkId: null }
  | { status: "reply_failed"; checkId: string; error: string }
  | { status: "skipped"; reason: string; checkId: string | null };

const TERMINAL = new Set<MentionRecord["status"]>(["replied", "reply_failed", "rate_limited"]);

/** UsageDay key for the bot-wide reply counter. Not an X user id. */
export const X_REPLY_COUNTER_ID = "lens:x_replies";

export async function botRepliesUsedToday(deps: LensDeps, now = new Date()): Promise<number> {
  return deps.store.getDailyCount(X_REPLY_COUNTER_ID, utcDay(now));
}

async function botReplyBudgetOpen(deps: LensDeps, now = new Date()): Promise<boolean> {
  const cap = deps.config.maxXRepliesPerDay;
  if (cap <= 0) return false;
  return (await botRepliesUsedToday(deps, now)) < cap;
}

export async function processMention(deps: LensDeps, incoming: IncomingMention): Promise<ProcessResult> {
  const existing = await deps.store.getMention(incoming.id);
  if (existing && TERMINAL.has(existing.status)) {
    return { status: "already_done", checkId: existing.checkId };
  }
  const postedReply = await deps.store.getPostedReply(incoming.id);
  if (postedReply) {
    if (existing) {
      await deps.store.updateMention(incoming.id, { status: "replied", checkId: postedReply.checkId });
    }
    return { status: "already_done", checkId: postedReply.checkId };
  }
  if (!existing) {
    await deps.store.saveMention({
      id: incoming.id,
      xUserId: incoming.authorId,
      xUsername: incoming.authorUsername,
      parentPostId: incoming.parentId ?? null,
      text: incoming.text,
      parentText: incoming.parentText ?? null,
      status: "processing",
      skipReason: null,
      checkId: null,
    });
  }

  try {
    await linkMentionAuthor(deps, incoming.authorId, incoming.authorUsername);
    const pro = await authorIsPro(deps, incoming.authorId, incoming.authorUsername);
    if (!pro) {
      const day = utcDay(new Date());
      const used = await deps.store.getDailyCount(incoming.authorId, day);
      if (used >= deps.config.rateLimitPerUserPerDay) {
        await deps.store.updateMention(incoming.id, {
          status: "rate_limited",
          skipReason: "daily limit",
        });
        return { status: "rate_limited", checkId: null };
      }
    }

    if (!(await botReplyBudgetOpen(deps))) {
      await deps.store.updateMention(incoming.id, {
        status: "rate_limited",
        skipReason: "bot daily reply cap",
      });
      log("bot daily reply cap reached", { cap: deps.config.maxXRepliesPerDay });
      return { status: "rate_limited", checkId: null };
    }

    let parentText = incoming.parentText ?? null;
    if (!parentText && incoming.parentId) {
      const parent = await deps.x.getPost(incoming.parentId);
      parentText = parent?.text ?? null;
      if (parentText) await deps.store.updateMention(incoming.id, { parentText });
    }

    const sourceText = [parentText, incoming.text].filter(Boolean).join("\n");
    const parentPostId = incoming.parentId ?? incoming.id;
    const askedToTrade = wantsTradeLink(incoming.text);

    const reusable = await resolveToken(sourceText, deps.provider);
    if (reusable?.status === "token") {
      const cached = await deps.store.findReusableCheck(parentPostId, reusable.mint);
      if (cached && cachedReplyMatchesSwap(deps, incoming.text, cached)) {
        return finishReply(deps, incoming, cached, true);
      }
    }

    const created = await createRiskCheck(deps, {
      kind: "reply",
      text: sourceText,
      claimText: claimSource(parentText, incoming.text),
      parentPostId,
      mentionId: incoming.id,
      askedBy: incoming.authorUsername,
      offerSwap: askedToTrade,
    });

    if (!created.ok && (created.error === "no_token" || created.error === "notice")) {
      if (askedToTrade) {
        log("swap link omitted", {
          reason: "token was not scored",
          symbol: created.error === "notice" ? created.symbol : undefined,
        });
      }
      const notice = await createUnresolvedCheck(deps, {
        mentionId: incoming.id,
        parentPostId,
        askedBy: incoming.authorUsername,
        sourceText,
        text: created.error === "notice" ? created.detail : undefined,
        symbol: created.error === "notice" ? created.symbol : undefined,
        name: created.error === "notice" ? created.name : undefined,
      });
      if (!notice.ok) {
        await deps.store.updateMention(incoming.id, {
          status: "error",
          skipReason: notice.detail ?? notice.error,
        });
        return { status: "skipped", reason: notice.error, checkId: null };
      }
      return finishReply(deps, incoming, notice.check, false);
    }

    if (!created.ok) {
      await deps.store.updateMention(incoming.id, {
        status: "error",
        skipReason: created.detail ?? created.error,
      });
      return { status: "skipped", reason: created.error, checkId: null };
    }

    return finishReply(deps, incoming, created.check, false);
  } catch (err) {
    const message = errorMessage(err);
    log("mention failed", message);
    await deps.store.updateMention(incoming.id, { status: "error", skipReason: message });
    return { status: "skipped", reason: message, checkId: null };
  }
}

function claimSource(parentText: string | null, mentionText: string): string {
  return parentText?.trim() ? parentText : mentionText;
}

/** A cached reply is reusable only when it already has the swap link this mention should get. */
function cachedReplyMatchesSwap(deps: LensDeps, mentionText: string, cached: CheckRecord): boolean {
  const decision = decideSwapLink({
    asked: wantsTradeLink(mentionText),
    enabled: deps.config.xSwapLinksOnRequest,
    publicBaseUrl: deps.config.publicBaseUrl,
    riskLevel: cached.riskLevel,
    mint: cached.tokenMint,
  });
  const hasLink = replyHasSwapLink(cached.replyText, cached.tokenMint);
  if ((decision?.include === true) === hasLink) {
    if (decision && !decision.include) {
      log("swap link omitted", { reason: decision.reason, symbol: cached.tokenSymbol });
    }
    return true;
  }
  return false;
}

async function finishReply(
  deps: LensDeps,
  incoming: IncomingMention,
  check: CheckRecord,
  cached: boolean,
): Promise<ProcessResult> {
  const already = await deps.store.getPostedReply(incoming.id);
  if (already) {
    await deps.store.updateMention(incoming.id, { status: "replied", checkId: already.checkId });
    return { status: "already_done", checkId: already.checkId };
  }
  try {
    const posted = await deps.x.reply({ inReplyToId: incoming.id, text: check.replyText });
    await deps.store.saveReply({
      id: newId(),
      mentionId: incoming.id,
      checkId: check.id,
      xReplyId: posted.id,
      text: check.replyText,
      cached,
    });
    if (!cached) await deps.store.updateCheck(check.id, { xPostId: posted.id });
    await deps.store.updateMention(incoming.id, { status: "replied", checkId: check.id });
    if (!(await authorIsPro(deps, incoming.authorId, incoming.authorUsername))) {
      await deps.store.incrementDailyCount(incoming.authorId, utcDay(new Date()));
    }
    await deps.store.incrementDailyCount(X_REPLY_COUNTER_ID, utcDay(new Date()));
    await queueWarningAlerts(deps, check);
    log(`${cached ? "cached reply" : "replied"} ${check.tokenSymbol} ${check.riskLevel} ${check.id}`);
    return {
      status: "replied",
      checkId: check.id,
      cached,
      replyText: check.replyText,
      riskLevel: check.riskLevel,
    };
  } catch (err) {
    const message = errorMessage(err);
    await deps.store.updateCheck(check.id, { status: "reply_failed", error: message });
    await deps.store.updateMention(incoming.id, {
      status: "reply_failed",
      checkId: check.id,
      skipReason: message,
    });
    return { status: "reply_failed", checkId: check.id, error: message };
  }
}

export async function createRiskCheck(
  deps: LensDeps,
  input: {
    kind: CheckKind | "auto";
    mint?: string;
    text?: string;
    claimText?: string;
    parentPostId?: string | null;
    mentionId?: string | null;
    askedBy?: string | null;
    now?: Date;
    /** Mention text asked to buy, swap, or trade. Ignored unless kind is reply. */
    offerSwap?: boolean;
  },
): Promise<
  | { ok: true; check: CheckRecord }
  | { ok: false; error: "no_token" | "token_not_found" | "proof_failed"; detail?: string }
  | { ok: false; error: "notice"; detail: string; symbol: string; name: string }
> {
  const now = input.now ?? new Date();
  const resolved = input.mint
    ? { status: "token" as const, mint: input.mint, symbol: null as string | null, name: null as string | null }
    : input.text
      ? await resolveToken(input.text, deps.provider)
      : null;
  if (!resolved) return { ok: false, error: "no_token" };
  if (resolved.status === "notice") {
    return { ok: false, error: "notice", detail: resolved.text, symbol: resolved.symbol, name: resolved.name };
  }

  const snapshot = await deps.provider.getToken(resolved.mint);
  if (!snapshot) return { ok: false, error: "token_not_found" };

  const claims = claimsFromPosts(input.claimText ?? input.text ?? "", "");
  const report = evaluateRisk(snapshotToRuleInput(snapshot, claims, now), snapshot.links);
  const kind: CheckKind =
    input.kind === "auto"
      ? report.level === "HIGH"
        ? "warning"
        : report.level === "LOW"
          ? "call"
          : "note"
      : input.kind;

  const id = newId();
  const reportUrl = `${deps.config.publicBaseUrl}/r/${id}`;
  const decision =
    input.kind === "reply"
      ? decideSwapLink({
          asked: input.offerSwap === true,
          enabled: deps.config.xSwapLinksOnRequest,
          publicBaseUrl: deps.config.publicBaseUrl,
          riskLevel: report.level,
          mint: snapshot.mint,
        })
      : null;
  const written = await deps.writer.write({
    riskLevel: report.level,
    symbol: snapshot.symbol,
    name: snapshot.name,
    mint: snapshot.mint,
    facts: report.facts,
    reportUrl,
    swapUrl: decision?.include ? decision.url : undefined,
  });
  if (decision?.include) {
    if (written.text.includes(decision.url)) {
      log("swap link included", { symbol: snapshot.symbol, mint: snapshot.mint });
    } else {
      log("swap link omitted", { reason: "reply would exceed 500 characters", symbol: snapshot.symbol });
    }
  } else if (decision) {
    log("swap link omitted", { reason: decision.reason, symbol: snapshot.symbol });
  }
  const signedAt = now;
  const proof = buildProofPayload(written.text, signedAt);
  let published: { signature: string; cluster: string };
  try {
    published = await deps.proofs.publish(proof.payload);
  } catch (err) {
    return { ok: false, error: "proof_failed", detail: errorMessage(err) };
  }

  const check = buildCheck({
    id,
    kind,
    mentionId: input.mentionId ?? null,
    parentPostId: input.parentPostId ?? null,
    snapshot,
    claims,
    riskLevel: report.level,
    score: report.score,
    dangerCount: report.dangerCount,
    cautionCount: report.cautionCount,
    unknownCount: report.unknownCount,
    facts: report.facts,
    replyText: written.text,
    sourcePostText: input.text ?? input.claimText ?? null,
    askedBy: input.askedBy ?? null,
    dataMode: deps.provider.name === "mock" ? "mock" : "live",
    signedAt,
    proof,
    published,
    now,
  });
  await deps.store.saveCheck(check);
  log(`proved ${snapshot.symbol} ${report.level} ${published.signature}`);
  return { ok: true, check };
}

export async function publishOutbound(deps: LensDeps, mint: string, now?: Date): Promise<
  | { ok: true; check: CheckRecord }
  | { ok: false; error: string; detail?: string; check?: CheckRecord }
> {
  const created = await createRiskCheck(deps, { kind: "auto", mint, claimText: "", now });
  if (!created.ok) return created;
  try {
    const posted = await deps.x.post(created.check.replyText);
    await deps.store.updateCheck(created.check.id, { xPostId: posted.id });
    created.check.xPostId = posted.id;
    await queueWarningAlerts(deps, created.check);
    return { ok: true, check: created.check };
  } catch (err) {
    const detail = errorMessage(err);
    await deps.store.updateCheck(created.check.id, { status: "reply_failed", error: detail });
    return { ok: false, error: "reply_failed", detail, check: created.check };
  }
}

async function createUnresolvedCheck(
  deps: LensDeps,
  input: {
    mentionId: string;
    parentPostId: string;
    askedBy: string;
    sourceText: string;
    text?: string;
    symbol?: string;
    name?: string;
  },
): Promise<{ ok: true; check: CheckRecord } | { ok: false; error: "proof_failed"; detail?: string }> {
  const text = assertSafeNotice(input.text ?? UNRESOLVED_REPLY);
  const now = new Date();
  const proof = buildProofPayload(text, now);
  let published: { signature: string; cluster: string };
  try {
    published = await deps.proofs.publish(proof.payload);
  } catch (err) {
    return { ok: false, error: "proof_failed", detail: errorMessage(err) };
  }
  const id = newId();
  const check: CheckRecord = {
    id,
    kind: "unresolved",
    mentionId: input.mentionId,
    parentPostId: input.parentPostId,
    tokenMint: "",
    tokenSymbol: input.symbol ?? "—",
    tokenName: input.name ?? "No token found",
    riskLevel: "NONE",
    score: 0,
    dangerCount: 0,
    cautionCount: 0,
    unknownCount: 0,
    facts: [],
    snapshot: null,
    claims: { burned: false, locked: false },
    sources: [],
    dataMode: deps.provider.name === "mock" ? "mock" : "live",
    replyText: text,
    sourcePostText: input.sourceText,
    priceAtCheck: null,
    askedBy: input.askedBy,
    status: "published",
    error: null,
    xPostId: null,
    createdAt: now.toISOString(),
    proof: proofRecord(proof, published, now),
    outcome: null,
  };
  await deps.store.saveCheck(check);
  return { ok: true, check };
}

function buildCheck(input: {
  id: string;
  kind: CheckKind;
  mentionId: string | null;
  parentPostId: string | null;
  snapshot: TokenSnapshot;
  claims: Claims;
  riskLevel: RiskLevel;
  score: number;
  dangerCount: number;
  cautionCount: number;
  unknownCount: number;
  facts: CheckRecord["facts"];
  replyText: string;
  sourcePostText: string | null;
  askedBy: string | null;
  dataMode: "mock" | "live";
  signedAt: Date;
  proof: ReturnType<typeof buildProofPayload>;
  published: { signature: string; cluster: string };
  now: Date;
}): CheckRecord {
  return {
    id: input.id,
    kind: input.kind,
    mentionId: input.mentionId,
    parentPostId: input.parentPostId,
    tokenMint: input.snapshot.mint,
    tokenSymbol: safeSymbol(input.snapshot.symbol, input.snapshot.mint),
    tokenName: scrubThirdPartyText(input.snapshot.name).slice(0, 80) || "token",
    riskLevel: input.riskLevel,
    score: input.score,
    dangerCount: input.dangerCount,
    cautionCount: input.cautionCount,
    unknownCount: input.unknownCount,
    facts: input.facts,
    snapshot: input.snapshot,
    claims: input.claims,
    sources: input.snapshot.sources,
    dataMode: input.dataMode,
    replyText: input.replyText,
    sourcePostText: input.sourcePostText,
    priceAtCheck: input.snapshot.priceUsd,
    askedBy: input.askedBy,
    status: "published",
    error: null,
    xPostId: null,
    createdAt: input.now.toISOString(),
    proof: proofRecord(input.proof, input.published, input.signedAt),
    outcome: null,
  };
}

function proofRecord(
  proof: ReturnType<typeof buildProofPayload>,
  published: { signature: string; cluster: string },
  signedAt: Date,
): ProofRecord {
  return {
    contentHash: proof.hash,
    signedAt: signedAt.toISOString(),
    payload: proof.payload,
    txSignature: published.signature,
    cluster: published.cluster,
    status: published.cluster === "mock" ? "mocked" : "confirmed",
    explorerUrl: explorerTxUrl(published.signature, published.cluster),
  };
}

const RECENT_MS = 20 * 3_600_000;

export async function postWatchlist(deps: LensDeps, now = new Date()): Promise<number> {
  const result = await runOutboundCycle(deps, { now, discover: false });
  return result.posted;
}

export async function runOutboundCycle(
  deps: LensDeps,
  opts?: { now?: Date; candidates?: TokenCandidate[]; discover?: boolean },
): Promise<{ posted: number; skipped: number; considered: number }> {
  if (!deps.config.outboundEnabled) return { posted: 0, skipped: 0, considered: 0 };
  const now = opts?.now ?? new Date();
  const day = utcDay(now);
  const cap = deps.config.outboundDailyCap;
  let posted = 0;
  let skipped = 0;
  let considered = 0;

  const room = async () => cap - (await deps.store.getOutboundCount(day));

  const tryMint = async (mint: string, discovered: boolean): Promise<"posted" | "capped" | "skipped"> => {
    if ((await room()) <= 0) return "capped";
    const recent = await deps.store.latestCheckForMint(mint, RECENT_MS, now);
    if (recent && (recent.kind === "call" || recent.kind === "warning" || recent.kind === "note")) {
      return "skipped";
    }
    if (discovered) {
      const snapshot = await deps.provider.getToken(mint);
      if (!snapshot) return "skipped";
      const report = evaluateRisk(
        snapshotToRuleInput(snapshot, { burned: false, locked: false }, now),
        snapshot.links,
      );
      if (report.level !== "HIGH" && report.level !== "LOW") return "skipped";
    }
    const result = await publishOutbound(deps, mint, now);
    if (!result.ok) {
      log("outbound skipped", { mint, error: result.error });
      return "skipped";
    }
    await deps.store.incrementOutboundCount(day);
    posted += 1;
    return "posted";
  };

  for (const mint of deps.config.outboundMints) {
    considered += 1;
    const outcome = await tryMint(mint, false);
    if (outcome === "capped") break;
    if (outcome === "skipped") skipped += 1;
  }

  const discover = opts?.discover ?? deps.config.outboundDiscover;
  let candidates = opts?.candidates;
  if (!candidates && discover) {
    try {
      candidates = await listDexCandidates();
    } catch (err) {
      log("discovery failed", errorMessage(err));
      candidates = [];
    }
  }
  const configured = new Set(deps.config.outboundMints);
  for (const candidate of candidates ?? []) {
    if (configured.has(candidate.mint)) continue;
    if ((await room()) <= 0) break;
    considered += 1;
    const outcome = await tryMint(candidate.mint, true);
    if (outcome === "capped") break;
    if (outcome === "skipped") skipped += 1;
  }

  return { posted, skipped, considered };
}

async function authorIsPro(deps: LensDeps, authorId: string, authorUsername: string): Promise<boolean> {
  const byId = await deps.store.findUser({ xUserId: authorId });
  const user = byId ?? (await deps.store.findUser({ xHandle: authorUsername }));
  return isActivePro(user);
}

async function linkMentionAuthor(deps: LensDeps, authorId: string, authorUsername: string): Promise<void> {
  const existing = await deps.store.findUser({ xHandle: authorUsername });
  if (!existing) return;
  if (existing.xUserId === authorId) return;
  await deps.store.upsertUser({
    xHandle: existing.xHandle,
    xUserId: authorId,
    wallet: existing.wallet,
  });
}

export { levelSummary };

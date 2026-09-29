import { claimsFromPosts } from "./claims.js";
import { errorMessage, log, newId, utcDay } from "./ids.js";
import { evaluateRisk, levelSummary, snapshotToRuleInput } from "./risk/engine.js";
import { assertSafeNotice, UNRESOLVED_REPLY } from "./reply/policy.js";
import type { ReplyWriter } from "./reply/writer.js";
import { buildProofPayload, explorerTxUrl } from "./proof/hash.js";
import type { ProofPublisher } from "./proof/solana.js";
import type { TokenDataProvider } from "./providers/types.js";
import { resolveToken } from "./resolver.js";
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

export async function processMention(deps: LensDeps, incoming: IncomingMention): Promise<ProcessResult> {
  const existing = await deps.store.getMention(incoming.id);
  if (existing && TERMINAL.has(existing.status)) {
    return { status: "already_done", checkId: existing.checkId };
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
    const day = utcDay(new Date());
    const used = await deps.store.getDailyCount(incoming.authorId, day);
    if (used >= deps.config.rateLimitPerUserPerDay) {
      await deps.store.updateMention(incoming.id, {
        status: "rate_limited",
        skipReason: "daily limit",
      });
      return { status: "rate_limited", checkId: null };
    }

    let parentText = incoming.parentText ?? null;
    if (!parentText && incoming.parentId) {
      const parent = await deps.x.getPost(incoming.parentId);
      parentText = parent?.text ?? null;
      if (parentText) await deps.store.updateMention(incoming.id, { parentText });
    }

    const sourceText = [parentText, incoming.text].filter(Boolean).join("\n");
    const claims = claimsFromPosts(parentText, incoming.text);
    const parentPostId = incoming.parentId ?? incoming.id;

    const reusableMint = await resolveToken(sourceText, deps.provider);
    if (reusableMint) {
      const cached = await deps.store.findReusableCheck(parentPostId, reusableMint.mint);
      if (cached) {
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
    });

    if (!created.ok && created.error === "no_token") {
      const notice = await createUnresolvedCheck(deps, {
        mentionId: incoming.id,
        parentPostId,
        askedBy: incoming.authorUsername,
        sourceText,
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

async function finishReply(
  deps: LensDeps,
  incoming: IncomingMention,
  check: CheckRecord,
  cached: boolean,
): Promise<ProcessResult> {
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
    await deps.store.incrementDailyCount(incoming.authorId, utcDay(new Date()));
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
  },
): Promise<
  | { ok: true; check: CheckRecord }
  | { ok: false; error: "no_token" | "token_not_found" | "proof_failed"; detail?: string }
> {
  const now = input.now ?? new Date();
  const resolved = input.mint
    ? { mint: input.mint, symbol: null as string | null, name: null as string | null }
    : input.text
      ? await resolveToken(input.text, deps.provider)
      : null;
  if (!resolved) return { ok: false, error: "no_token" };

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
  const written = await deps.writer.write({
    riskLevel: report.level,
    symbol: snapshot.symbol,
    name: snapshot.name,
    facts: report.facts,
    reportUrl,
  });
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
    return { ok: true, check: created.check };
  } catch (err) {
    const detail = errorMessage(err);
    await deps.store.updateCheck(created.check.id, { status: "reply_failed", error: detail });
    return { ok: false, error: "reply_failed", detail, check: created.check };
  }
}

async function createUnresolvedCheck(
  deps: LensDeps,
  input: { mentionId: string; parentPostId: string; askedBy: string; sourceText: string },
): Promise<{ ok: true; check: CheckRecord } | { ok: false; error: "proof_failed"; detail?: string }> {
  const text = assertSafeNotice(UNRESOLVED_REPLY);
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
    tokenSymbol: "—",
    tokenName: "No token found",
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
    tokenSymbol: input.snapshot.symbol,
    tokenName: input.snapshot.name,
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

export async function postWatchlist(deps: LensDeps, now = new Date()): Promise<number> {
  if (!deps.config.outboundEnabled || deps.config.outboundMints.length === 0) return 0;
  let posted = 0;
  for (const mint of deps.config.outboundMints) {
    const recent = await deps.store.latestCheckForMint(mint, 20 * 3_600_000, now);
    if (recent && (recent.kind === "call" || recent.kind === "warning" || recent.kind === "note")) {
      continue;
    }
    const result = await publishOutbound(deps, mint, now);
    if (result.ok) posted += 1;
    else log(`outbound skipped ${mint}`, result.error);
  }
  return posted;
}

export { levelSummary };

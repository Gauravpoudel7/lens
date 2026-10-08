import { log } from "../ids.js";
import type { LensConfig } from "../types.js";
import {
  buildTemplateReply,
  closerLine,
  DISCLAIMER,
  enforceReplyPolicy,
  factsForReply,
  publicSiteLabel,
  replyHeader,
  shortMint,
  type ReplyDraftInput,
} from "./policy.js";
import { prepareReplyDraft, scrubThirdPartyText } from "./sanitize.js";

export interface ReplyWriter {
  write(input: ReplyDraftInput): Promise<{ text: string; mode: "llm" | "template" }>;
}

const SYSTEM_SHARED = [
  "You write a public reply for Lens, a Solana token risk bot on X.",
  "The risk level is already decided. Repeat it. Do not change it.",
  "Use only the facts you are given. Do not add claims, names, or numbers.",
  "Never use the word scam, fraud, or rug. Do not accuse a person.",
  "Do not give buy or sell advice.",
  "Plain English. No hashtags.",
  "Stay under 270 characters.",
];

type WriterConfig = Pick<
  LensConfig,
  "llmMode" | "llmApiKey" | "llmBaseUrl" | "llmModel" | "publicBaseUrl" | "publicSiteName" | "xReplyLinks"
>;

function systemPrompt(input: ReplyDraftInput): string {
  const lines = [...SYSTEM_SHARED];
  if (input.swapUrl) {
    lines.push("Do not include any URL. A swap link is added after you write.");
  } else if (input.includeLinks) {
    lines.push("At most three short lines plus the report link.");
  } else {
    lines.push("Do not include any URL, t.co link, or domain name.");
    const closer = closerLine(input);
    if (closer) lines.push(`After the facts, end with this exact line: ${closer}`);
    else lines.push("Do not mention a scorecard or a website.");
  }
  if (input.mint) lines.push(`Name the token with this short mint, exactly: ${shortMint(input.mint)}.`);
  lines.push("End with this exact sentence: Not financial advice.");
  return lines.join(" ");
}

export function createReplyWriter(config: WriterConfig): ReplyWriter {
  return {
    async write(input) {
      const draft: ReplyDraftInput = {
        ...input,
        includeLinks: config.xReplyLinks === true,
        siteLabel: input.siteLabel ?? publicSiteLabel(config),
      };
      const safe = prepareReplyDraft(draft);
      const template = buildTemplateReply(safe);
      const enforcedTemplate = enforceReplyPolicy(template, safe);
      const fallback = enforcedTemplate.ok ? enforcedTemplate.text : safeFallbackReply(safe);
      if (config.llmMode === "template" || !config.llmApiKey) {
        return { text: fallback, mode: "template" };
      }
      try {
        const drafted = scrubThirdPartyText(await draftWithLlm(config, safe));
        const enforced = enforceReplyPolicy(drafted, safe);
        if (!enforced.ok) {
          log(`LLM reply rejected (${enforced.reason}); using template`);
          return { text: fallback, mode: "template" };
        }
        return { text: enforced.text, mode: "llm" };
      } catch (err) {
        log(`LLM reply failed; using template`, err instanceof Error ? err.message : err);
        return { text: fallback, mode: "template" };
      }
    },
  };
}

export function safeFallbackReply(input: ReplyDraftInput): string {
  const text = `${replyHeader(input.symbol, input.riskLevel, input.mint)}\n${DISCLAIMER}`;
  const enforced = enforceReplyPolicy(text, { ...input, facts: [] });
  if (enforced.ok) return enforced.text;
  return `${input.riskLevel} risk.\n${DISCLAIMER}`;
}

async function draftWithLlm(config: WriterConfig, input: ReplyDraftInput): Promise<string> {
  const facts = factsForReply(input.facts)
    .map((fact) => `- ${fact.text}`)
    .join("\n");
  const linked = input.includeLinks === true;
  const user = [
    `Risk level: ${input.riskLevel}`,
    `Token: ${input.symbol} (${input.name})`,
    input.mint ? `Short mint: ${shortMint(input.mint)}` : null,
    linked ? `Report URL: ${input.reportUrl}` : null,
    "Facts:",
    facts || "- No facts.",
  ]
    .filter((line): line is string => line != null)
    .join("\n");
  const response = await fetch(`${config.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.llmApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.llmModel,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt(input) },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`LLM HTTP ${response.status}`);
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("LLM returned an empty reply");
  return content;
}

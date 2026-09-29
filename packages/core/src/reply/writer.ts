import { log } from "../ids.js";
import type { LensConfig } from "../types.js";
import { buildTemplateReply, enforceReplyPolicy, SCORECARD_LINE, type ReplyDraftInput } from "./policy.js";

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

const SYSTEM_WITH_LINKS = [
  ...SYSTEM_SHARED,
  "At most three short lines plus the report link.",
  "End with this exact sentence: Not financial advice.",
].join(" ");

const SYSTEM_NO_LINKS = [
  ...SYSTEM_SHARED,
  "Do not include any URL, t.co link, or domain name.",
  `After the facts, end with this exact line: ${SCORECARD_LINE}`,
  "Then end with this exact sentence: Not financial advice.",
].join(" ");

type WriterConfig = Pick<LensConfig, "llmMode" | "llmApiKey" | "llmBaseUrl" | "llmModel"> & {
  xReplyLinks?: boolean;
};

export function createReplyWriter(config: WriterConfig): ReplyWriter {
  return {
    async write(input) {
      const draft: ReplyDraftInput = { ...input, includeLinks: config.xReplyLinks === true };
      const template = buildTemplateReply(draft);
      const enforcedTemplate = enforceReplyPolicy(template, draft);
      const fallback = enforcedTemplate.ok ? enforcedTemplate.text : template;
      if (config.llmMode === "template" || !config.llmApiKey) {
        return { text: fallback, mode: "template" };
      }
      try {
        const drafted = await draftWithLlm(config, draft);
        const enforced = enforceReplyPolicy(drafted, draft);
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

async function draftWithLlm(config: WriterConfig, input: ReplyDraftInput): Promise<string> {
  const facts = input.facts.map((fact) => `- ${fact.text}`).join("\n");
  const linked = input.includeLinks === true;
  const user = [
    `Risk level: ${input.riskLevel}`,
    `Token: ${input.symbol} (${input.name})`,
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
        { role: "system", content: linked ? SYSTEM_WITH_LINKS : SYSTEM_NO_LINKS },
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

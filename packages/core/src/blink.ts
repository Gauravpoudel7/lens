import type { CheckRecord, LensConfig } from "./types.js";
import { levelSummary } from "./risk/engine.js";
import { DISCLAIMER } from "./reply/policy.js";

export interface BlinkAction {
  type: "action";
  icon: string;
  title: string;
  description: string;
  label: string;
  disabled?: boolean;
  links?: {
    actions: Array<{
      type?: "transaction" | "external-link";
      label: string;
      href: string;
      parameters?: Array<{
        name: string;
        label?: string;
        required?: boolean;
        type?: "number" | "text";
        min?: number;
        max?: number;
      }>;
    }>;
  };
  error?: { message: string };
}

/** CORS for Action endpoints and for `/actions.json`. */
export const ACTION_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Version, X-Accept-Blockchain-Ids",
  "Access-Control-Expose-Headers": "Content-Type, Content-Encoding, X-Action-Version, X-Blockchain-Ids",
};

/** Headers on `GET` and `POST /api/actions/trade/:mint`. */
export const ACTION_RESPONSE_HEADERS: Record<string, string> = {
  ...ACTION_CORS_HEADERS,
  "Content-Type": "application/json",
  "X-Action-Version": "2.4",
  "X-Blockchain-Ids": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
};

/** Served at `/actions.json` with the same CORS origin header. */
export const ACTIONS_JSON_HEADERS: Record<string, string> = {
  ...ACTION_CORS_HEADERS,
  "Content-Type": "application/json",
};

/**
 * Idempotent rule so a shared `/api/actions/...` URL is itself an Action.
 * Spec: pathPattern maps the website path to the Action API path.
 */
export const ACTIONS_JSON = {
  rules: [
    // The human page from the reply swap link unfurls as the same Action.
    { pathPattern: "/trade/*", apiPath: "/api/actions/trade/*" },
    {
      pathPattern: "/api/actions/**",
      apiPath: "/api/actions/**",
    },
  ],
} as const;

export function buildBlinkAction(check: CheckRecord, config: Pick<LensConfig, "publicBaseUrl">): BlinkAction {
  const icon = `${config.publicBaseUrl}/mark.png`;
  const reportUrl = `${config.publicBaseUrl}/r/${check.id}`;
  const facts = check.facts
    .filter((fact) => fact.signal === "danger" || fact.signal === "caution")
    .slice(0, 4)
    .map((fact) => `• ${fact.short}`)
    .join("\n");
  const summary =
    check.riskLevel === "NONE"
      ? "Lens could not score this token."
      : levelSummary(check.riskLevel);
  const description = [
    `$${check.tokenSymbol}: ${check.riskLevel} risk.`,
    summary,
    facts,
    `Report: ${reportUrl}`,
    DISCLAIMER,
  ]
    .filter(Boolean)
    .join("\n");

  if (check.riskLevel === "HIGH") {
    return {
      type: "action",
      icon,
      title: `HIGH risk · $${check.tokenSymbol}`,
      description: `Buying is turned off.\n${description}`,
      label: "High risk",
      disabled: true,
      links: {
        actions: [{ type: "external-link", label: "Read the report", href: reportUrl }],
      },
      error: {
        message: `Lens rated $${check.tokenSymbol} HIGH risk. A buy button is not shown. ${DISCLAIMER}`,
      },
    };
  }

  const base = `${config.publicBaseUrl}/api/actions/trade/${check.tokenMint}`;
  return {
    type: "action",
    icon,
    title: `Buy $${check.tokenSymbol} · ${check.riskLevel} risk`,
    description,
    label: "Buy",
    links: {
      actions: [
        { type: "transaction", label: "Buy 0.1 SOL", href: `${base}?amount=0.1` },
        { type: "transaction", label: "Buy 0.5 SOL", href: `${base}?amount=0.5` },
        { type: "transaction", label: "Buy 1 SOL", href: `${base}?amount=1` },
        {
          type: "transaction",
          label: "Buy",
          href: `${base}?amount={amount}`,
          parameters: [
            { name: "amount", label: "SOL amount", type: "number", required: true, min: 0.000001, max: 50 },
          ],
        },
        { type: "external-link", label: "Read the report", href: reportUrl },
      ],
    },
  };
}

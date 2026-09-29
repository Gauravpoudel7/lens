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
      parameters?: Array<{ name: string; label?: string; required?: boolean }>;
    }>;
  };
  error?: { message: string };
}

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
          parameters: [{ name: "amount", label: "SOL amount", required: true }],
        },
        { type: "external-link", label: "Read the report", href: reportUrl },
      ],
    },
  };
}

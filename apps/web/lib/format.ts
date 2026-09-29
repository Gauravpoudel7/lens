import type { CheckRecord } from "@lens/core";

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return (
    new Intl.DateTimeFormat("en-GB", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    }).format(date) + " UTC"
  );
}

export function formatChange(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatRate(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `$${Math.round(value).toLocaleString("en-US")}`;
  if (value >= 1) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(3)}`;
}

export function kindLabel(kind: CheckRecord["kind"]): string {
  switch (kind) {
    case "reply":
      return "Reply";
    case "call":
      return "Call";
    case "warning":
      return "Warning";
    case "note":
      return "Note";
    case "manual":
      return "Manual";
    case "blink":
      return "Blink";
    case "unresolved":
      return "No token";
  }
}

export function outcomeLabel(check: CheckRecord, windowDays: number): string {
  if (check.kind === "unresolved" || check.riskLevel === "NONE") return "Not scored";
  if (!check.outcome) {
    const due = new Date(Date.parse(check.createdAt) + windowDays * 86_400_000);
    return `Scores ${formatTime(due.toISOString())}`;
  }
  if (check.outcome.callResult === "unscored" || check.outcome.priceChangePct == null) return "Unscored";
  const change = formatChange(check.outcome.priceChangePct);
  if (check.kind === "call") return `${change} · ${check.outcome.callResult}`;
  if (check.kind === "warning") {
    return `${change} · ${check.outcome.callResult === "correct" ? "warning held" : "warning missed"}`;
  }
  if (check.outcome.labelCorrect == null) return change;
  return `${change} · ${check.outcome.labelCorrect ? "label held" : "label missed"}`;
}

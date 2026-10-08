import { levelName } from "@/lib/facts";

export function RiskStamp({ level, compact = false }: { level: string; compact?: boolean }) {
  if (level === "NONE") {
    return <span className="text-base font-medium text-muted">Not scored</span>;
  }
  const name = levelName(level);
  const tone = level === "HIGH" ? "text-high" : level === "MEDIUM" ? "text-med" : "text-low";
  const code = level;
  if (compact) return <span className={`font-semibold tracking-wide ${tone}`}>{code}</span>;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={`font-semibold tracking-wide ${tone}`}>{code}</span>
      <span className="text-base text-muted">{name}</span>
    </span>
  );
}

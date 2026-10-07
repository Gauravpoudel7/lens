import { levelName } from "@/lib/facts";

export function RiskStamp({ level }: { level: string }) {
  if (level === "NONE") {
    return <span className="text-sm font-medium text-muted">Not scored</span>;
  }
  const name = levelName(level);
  const tone = level === "HIGH" ? "text-high" : level === "MEDIUM" ? "text-med" : "text-low";
  const code = level;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={`font-semibold tracking-wide ${tone}`}>{code}</span>
      <span className="text-sm text-muted">{name}</span>
    </span>
  );
}

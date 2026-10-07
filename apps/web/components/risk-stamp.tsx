import { levelName } from "@/lib/facts";

export function RiskStamp({ level }: { level: string }) {
  const name = levelName(level);
  const tone =
    level === "HIGH" ? "text-high" : level === "MEDIUM" ? "text-med" : level === "LOW" ? "text-low" : "text-muted";
  const code = level === "NONE" ? "NONE" : level;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={`font-semibold tracking-wide ${tone}`}>{code}</span>
      <span className="text-sm text-muted">{name}</span>
    </span>
  );
}

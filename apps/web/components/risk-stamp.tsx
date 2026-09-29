export function RiskStamp({ level, large = false }: { level: string; large?: boolean }) {
  const tone =
    level === "HIGH"
      ? "border-high text-high"
      : level === "MEDIUM"
        ? "border-med text-med"
        : level === "LOW"
          ? "border-low text-low"
          : "border-line text-muted";
  return (
    <span
      className={`inline-flex items-center justify-center border-2 font-serif font-semibold uppercase tracking-[0.16em] ${tone} ${
        large ? "px-3 py-1 text-2xl" : "px-2 py-0.5 text-xs"
      }`}
      style={{ transform: "rotate(-1.5deg)" }}
    >
      {level === "NONE" ? "No token" : level}
    </span>
  );
}

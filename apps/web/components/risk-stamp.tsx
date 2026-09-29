export function RiskStamp({ level, large = false }: { level: string; large?: boolean }) {
  const tone =
    level === "HIGH"
      ? "bg-rose-500/15 text-rose-300 ring-rose-400/50"
      : level === "MEDIUM"
        ? "bg-amber-400/15 text-amber-200 ring-amber-300/50"
        : level === "LOW"
          ? "bg-emerald-400/15 text-emerald-300 ring-emerald-300/50"
          : "bg-white/5 text-zinc-400 ring-white/15";
  const label = level === "NONE" ? "No token" : level;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold tracking-[0.14em] ring-1 ${tone} ${
        large ? "px-5 py-2 text-3xl sm:text-4xl" : "px-2.5 py-1 text-[11px]"
      }`}
    >
      {label}
    </span>
  );
}

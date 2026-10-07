export function Notice({
  tone,
  title,
  children,
}: {
  tone: "bad" | "wait" | "ok" | "info";
  title?: string;
  children: React.ReactNode;
}) {
  const box =
    tone === "bad"
      ? "border-high/40 bg-high-bg text-high"
      : tone === "ok"
        ? "border-low/40 bg-low-bg text-low"
        : tone === "wait"
          ? "border-med/40 bg-med-bg text-med"
          : "border-line bg-panel text-muted";
  return (
    <div className={`rounded-xl border px-3 py-3 text-sm leading-6 ${box}`} role={tone === "bad" ? "alert" : "status"}>
      {title ? <p className="font-semibold text-ink">{title}</p> : null}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}

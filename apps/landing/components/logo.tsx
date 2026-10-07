import { cn } from "@/lib/utils";

// Aperture mark: six blades around an open center.
export function ApertureMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-7", className)}>
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeOpacity=".9" />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <path
          key={deg}
          d="M16 1.5 L22.5 12.2"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          transform={`rotate(${deg} 16 16)`}
        />
      ))}
      <circle cx="16" cy="16" r="4" fill="currentColor" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      <ApertureMark className="size-7" />
      <span className="text-[17px] font-semibold tracking-[-0.02em]">Lens</span>
    </span>
  );
}

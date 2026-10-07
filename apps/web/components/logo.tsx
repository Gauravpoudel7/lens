import { cn } from "@/lib/utils";

/** Same aperture mark as the landing page. Strokes follow currentColor. */
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

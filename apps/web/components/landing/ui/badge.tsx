import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/[0.04] text-body",
        low: "border-low/30 bg-low/10 text-low shadow-[0_0_18px_-4px_var(--low)]",
        medium: "border-med/30 bg-med/10 text-med shadow-[0_0_18px_-4px_var(--med)]",
        high: "border-high/40 bg-high/10 text-[#fb7185] shadow-[0_0_18px_-4px_var(--high)]",
        placeholder: "border-dashed border-white/20 bg-transparent text-faint",
        proof: "border-sol-mint/25 bg-sol-mint/[0.07] text-[#7cf7c4]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export type Risk = "LOW" | "MEDIUM" | "HIGH";

function RiskPill({ level, className }: { level: Risk; className?: string }) {
  const variant = level === "LOW" ? "low" : level === "MEDIUM" ? "medium" : "high";
  return (
    <Badge variant={variant} className={cn("font-mono tracking-wide", className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {level}
    </Badge>
  );
}

export { Badge, RiskPill, badgeVariants };

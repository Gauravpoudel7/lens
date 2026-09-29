import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-32 w-full rounded-sm border border-line bg-paper-2 px-3 py-3 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ink/20 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

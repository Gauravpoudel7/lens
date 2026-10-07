import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-32 w-full rounded-xl border border-line bg-paper px-3 py-3 text-sm text-ink outline-none placeholder:text-faint focus-visible:border-ink disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

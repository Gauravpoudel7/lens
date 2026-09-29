import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-32 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-emerald-300/40 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

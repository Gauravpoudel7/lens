import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-emerald-300/40 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

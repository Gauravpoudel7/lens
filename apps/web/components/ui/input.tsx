import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink outline-none placeholder:text-faint focus-visible:border-ink disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

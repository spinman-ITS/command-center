import { cn } from "@/shared/lib/utils";
import type { SelectHTMLAttributes } from "react";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full appearance-none rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:bg-white/8",
        className,
      )}
      {...props}
    />
  );
}

import { cn } from "@/shared/lib/utils";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/50 focus:bg-white/8",
        className,
      )}
      {...props}
    />
  );
}

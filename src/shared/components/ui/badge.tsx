import { cn } from "@/shared/lib/utils";
import type { PropsWithChildren } from "react";

interface BadgeProps extends PropsWithChildren {
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export function Badge({ children, tone = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
        tone === "default" && "border-white/10 bg-white/8 text-slate-300",
        tone === "success" && "border-emerald-400/20 bg-emerald-400/12 text-emerald-200",
        tone === "warning" && "border-amber-300/20 bg-amber-300/12 text-amber-100",
        tone === "danger" && "border-rose-400/20 bg-rose-400/12 text-rose-200",
        className,
      )}
    >
      {children}
    </span>
  );
}

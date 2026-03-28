import { cn } from "@/shared/lib/utils";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, PropsWithChildren {
  variant?: ButtonVariant;
}

export function Button({ children, className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition duration-200",
        variant === "primary" &&
          "border-emerald-400/20 bg-emerald-300/10 text-emerald-100 hover:border-emerald-300/50 hover:bg-emerald-300/15",
        variant === "secondary" &&
          "border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10",
        variant === "ghost" && "border-transparent bg-transparent text-slate-300 hover:bg-white/6 hover:text-white",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

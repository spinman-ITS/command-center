import { cn } from "@/shared/lib/utils";
import type { HTMLAttributes, PropsWithChildren } from "react";

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(20,26,40,0.92),rgba(9,12,20,0.96))] shadow-[0_20px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

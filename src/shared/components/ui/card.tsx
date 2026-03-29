import { cn } from "@/shared/lib/utils";
import { forwardRef, type HTMLAttributes, type PropsWithChildren } from "react";

export const Card = forwardRef<HTMLDivElement, PropsWithChildren<HTMLAttributes<HTMLDivElement>>>(
  function Card({ children, className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(20,26,40,0.92),rgba(9,12,20,0.96))] shadow-[0_20px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

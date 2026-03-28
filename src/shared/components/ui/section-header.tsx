import type { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">{eyebrow}</p>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-white md:text-4xl">{title}</h1>
          <p className="max-w-2xl text-sm text-slate-400 md:text-base">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

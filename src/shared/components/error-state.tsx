interface ErrorStateProps {
  title: string;
  description: string;
}

export function ErrorState({ title, description }: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-100">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-rose-200/80">{description}</p>
    </div>
  );
}

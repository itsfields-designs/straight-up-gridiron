import type { LucideIcon } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="h-20 animate-pulse rounded-lg border border-border bg-card" />
      <div className="h-20 animate-pulse rounded-lg border border-border bg-card" />
      <div className="h-20 animate-pulse rounded-lg border border-border bg-card" />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-card px-5 py-8 text-center">
      {Icon && <Icon size={22} className="mx-auto text-accent" aria-hidden="true" />}
      <h2 className="mt-2 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
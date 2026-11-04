import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-gradient-to-b from-primary/[0.05] via-transparent to-cyan-500/[0.04] px-6 py-16 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-primary/25">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="relative mt-4 text-base font-semibold tracking-tight">{title}</h3>
      <p className="relative mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionHref && (
        <a href={actionHref} className="relative mt-5 inline-flex">
          <Button>{actionLabel}</Button>
        </a>
      )}
    </div>
  );
}

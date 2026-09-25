import type { LucideIcon } from "lucide-react";

export function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
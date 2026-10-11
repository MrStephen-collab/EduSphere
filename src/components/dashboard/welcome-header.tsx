import { cn } from "cn";

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function WelcomeHeader({
  name,
  subtitle,
  actions,
  className,
}: {
  name: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const greeting = greetingFor(new Date());
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {greeting}, {name} <span aria-hidden="true">👋</span>
        </h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

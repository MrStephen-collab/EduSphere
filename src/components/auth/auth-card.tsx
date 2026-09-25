import Link from "next/link";
import { EduSphereLogo } from "@/components/brand/logo";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center">
          <EduSphereLogo variant="standard" size="lg" className="shrink-0" />
        </Link>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
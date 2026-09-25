import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { siteConfig } from "@/config/site";

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
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" aria-hidden="true" />
          </div>
          <span className="text-xl font-semibold">{siteConfig.name}</span>
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
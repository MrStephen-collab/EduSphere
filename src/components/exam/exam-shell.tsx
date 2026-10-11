import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EduSphereLogo } from "@/components/brand/logo";

/**
 * Full-screen, distraction-free shell for an active practice/exam attempt.
 * Hides the app sidebar and header so a candidate focuses on the paper, while
 * keeping a slim exit and the EduSphere mark for reassurance.
 */
export function ExamShell({
  title,
  meta,
  exitHref,
  children,
}: {
  title: string;
  meta?: string;
  exitHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link href={exitHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Exit practice
          </Link>
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold tracking-tight sm:text-base">{title}</p>
            {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
          </div>
          <Link href="/" aria-label="EduSphere home" className="shrink-0">
            <EduSphereLogo variant="icon" size="sm" />
          </Link>
        </div>
      </header>

      <main id="exam-main" className="flex-1">{children}</main>
    </div>
  );
}
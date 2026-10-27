"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";

/**
 * A page section that can be folded away.
 *
 * Long dashboards (student, parent, teacher, school, platform) stack several
 * independent blocks — fees, analytics, admissions, results — and reading one
 * thing meant scrolling past everything else. Wrapping each block in this
 * component keeps the page short: the first section opens by default and the
 * rest stay folded until the reader asks for them.
 *
 * Content is hidden with `hidden` rather than unmounted, and `print:block`
 * cancels it on paper, so printing a dashboard still prints every section.
 */
export function CollapsibleSection({
  title,
  description,
  action,
  children,
  defaultOpen = false,
  className,
  contentClassName,
}: {
  title: string;
  description?: ReactNode;
  /** Optional control shown to the right of the header (e.g. a "View all" link). */
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className={className}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex min-w-0 flex-1 items-start justify-between gap-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-md"
        >
          <span className="min-w-0">
            <span className="block text-lg font-semibold tracking-tight">{title}</span>
            {description ? (
              <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
            ) : null}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div
        id={contentId}
        hidden={!open}
        className={cn("print:block", contentClassName)}
      >
        {children}
      </div>
    </section>
  );
}

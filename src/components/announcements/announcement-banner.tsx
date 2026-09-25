import { Megaphone } from "lucide-react";
import { announcementTargetLabels } from "@/lib/announcement-labels";
import type { Announcement } from "@/types/database";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}

export function AnnouncementBanner({
  announcements,
  className,
}: {
  announcements: Announcement[];
  className?: string;
}) {
  if (!announcements || announcements.length === 0) return null;

  return (
    <section className={className} aria-label="Announcements">
      <ul className="grid gap-2">
        {announcements.map((a) => (
          <li
            key={a.id}
            className="flex items-start gap-3 rounded-lg border bg-card p-3"
          >
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Megaphone className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {a.title}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {announcementTargetLabels[a.target_type]}
                </span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                {a.message}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(a.published_at)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
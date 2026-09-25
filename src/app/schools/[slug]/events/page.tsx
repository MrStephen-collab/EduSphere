import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { getSchoolSite, getSiteEvents } from "@/services/school-site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  return { title: site ? `Events at ${site.name}` : "Events" };
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  if (!site) notFound();

  const events = await getSiteEvents(site.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
      <h1 className="text-3xl font-bold">Events</h1>
      <p className="mt-2 text-muted-foreground">School events and key dates at {site.name}.</p>

      {events.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden">
              {event.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.coverUrl}
                  alt={event.title}
                  className="h-36 w-full object-cover"
                />
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{event.title}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    {formatDate(event.startsAt, { day: "numeric", month: "long", year: "numeric" })}
                    {event.endsAt && event.endsAt !== event.startsAt
                      ? ` – ${formatDate(event.endsAt, { day: "numeric", month: "long", year: "numeric" })}`
                      : ""}
                  </span>
                  {event.venue && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {event.venue}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              {event.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">
          No events published yet. Check back soon.
        </p>
      )}
    </div>
  );
}
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarCheck2, GraduationCap, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import {
  getSchoolSite,
  getSiteEvents,
  getSiteNews,
} from "@/services/school-site";

export default async function SchoolHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  if (!site) notFound();

  const [news, events] = await Promise.all([
    getSiteNews(site.id),
    getSiteEvents(site.id),
  ]);

  const upcoming = events.slice(0, 3);

  return (
    <div>
      <section
        className="py-16 text-white lg:py-24"
        style={{
          background:
            `linear-gradient(135deg, ${site.colors.primary}, ${site.colors.secondary})`,
        }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex size-14 items-center justify-center rounded-xl bg-white/15">
            <GraduationCap className="size-8" aria-hidden="true" />
          </div>
          <h1 className="mt-6 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Welcome to {site.name}
          </h1>
          {site.motto && (
            <p className="mt-3 max-w-2xl text-lg text-white/85">{site.motto}</p>
          )}
          {site.description && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/75">
              {site.description}
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="bg-white text-foreground hover:bg-white/90"
              render={<Link href={`/schools/${site.slug}/admissions`} />}
            >
              Admissions
            </Button>
            <Button
              size="lg"
              variant="ghost"
              render={<Link href="/auth/login" />}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              Student login
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 lg:py-16">
        {news.length > 0 && (
          <section aria-labelledby="school-news-heading">
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="school-news-heading"
                className="flex items-center gap-2 text-xl font-semibold"
              >
                <Megaphone className="size-5" aria-hidden="true" />
                Latest news
              </h2>
              <Link
                href={`/schools/${site.slug}/news`}
                className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                style={{ color: site.colors.primary }}
              >
                View all <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {news.slice(0, 3).map((item) => (
                <Card key={item.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    <CardDescription>{formatDate(item.publishedAt)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {item.message}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {upcoming.length > 0 && (
          <section aria-labelledby="school-events-heading">
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="school-events-heading"
                className="flex items-center gap-2 text-xl font-semibold"
              >
                <CalendarCheck2 className="size-5" aria-hidden="true" />
                Latest events
              </h2>
              <Link
                href={`/schools/${site.slug}/events`}
                className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                style={{ color: site.colors.primary }}
              >
                View all <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((event) => (
                <Card key={event.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{event.title}</CardTitle>
                    <CardDescription>
                      {formatDate(event.startsAt, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      {event.venue ? ` · ${event.venue}` : ""}
                    </CardDescription>
                  </CardHeader>
                  {event.description && (
                    <CardContent>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="school-academics-heading">
          <h2 id="school-academics-heading" className="mb-4 text-xl font-semibold">
            Our curriculum
          </h2>
          <div className="flex flex-wrap gap-2">
            {site.subjects.map((subject) => (
              <span
                key={subject.id}
                className="rounded-full border bg-muted px-3 py-1 text-sm"
              >
                {subject.name}
              </span>
            ))}
            {site.subjects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Subject details are being prepared. Contact the school for more.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-muted/40 p-6 text-center sm:p-8">
          <h2 className="text-xl font-semibold">Ready to join {site.name}?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Learn how to apply, sit the entrance assessment and enrol at {site.name}.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button render={<Link href={`/schools/${site.slug}/admissions`} />}>
              Start the admissions journey
            </Button>
            <Button
              variant="outline"
              render={<Link href={`/schools/${site.slug}/contact`} />}
            >
              Contact the school
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
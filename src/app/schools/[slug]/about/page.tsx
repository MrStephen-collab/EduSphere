import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, GraduationCap, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSchoolSite } from "@/services/school-site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  return { title: site ? `About ${site.name}` : "About" };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  if (!site) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
      <h1 className="text-3xl font-bold">About {site.name}</h1>
      {site.motto && <p className="mt-2 text-muted-foreground">{site.motto}</p>}

      {site.description && (
        <p className="mt-6 max-w-3xl leading-relaxed text-muted-foreground">
          {site.description}
        </p>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium">Classes</p>
            <p className="mt-1 text-2xl font-bold">{site.classes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium">Subjects taught</p>
            <p className="mt-1 text-2xl font-bold">{site.subjects.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium">Digital classroom</p>
            <p className="mt-1 text-2xl font-bold">Yes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium">CBT &amp; assessments</p>
            <p className="mt-1 text-2xl font-bold">Yes</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="space-y-3 text-sm text-muted-foreground lg:col-span-1">
          <h2 className="text-lg font-semibold text-foreground">Get in touch</h2>
          {site.address && (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {site.address}
                {site.city || site.state ? `, ${[site.city, site.state].filter(Boolean).join(", ")}` : ""}
              </span>
            </p>
          )}
          {site.phone && (
            <p className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" aria-hidden="true" />
              <a href={`tel:${site.phone}`} className="hover:underline">
                {site.phone}
              </a>
            </p>
          )}
          {site.email && (
            <p className="flex items-center gap-2">
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              <a href={`mailto:${site.email}`} className="hover:underline">
                {site.email}
              </a>
            </p>
          )}
          <div className="pt-2">
            <Button
              render={<Link href={`/schools/${site.slug}/contact`} />}
            >
              Contact page
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <GraduationCap className="size-5" aria-hidden="true" />
            Learning at {site.name}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {site.name} uses EduSphere, a digital classroom that brings courses, lessons,
            assignments and timed computer-based tests together in one place. Students log in
            to learn, practise past-question series and track their progress; teachers mark
            work and release report cards; parents follow their child&apos;s results and
            attendance term by term.
          </p>
          <ul className="mt-4 grid max-w-2xl gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li>· Courses, modules and lessons with notes and videos</li>
            <li>· Assignments with teacher feedback</li>
            <li>· CBT practice for Common Entrance, WAEC, NECO and JAMB</li>
            <li>· Attendance, report cards and analytics</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
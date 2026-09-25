import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap, Mail, MapPin, Phone, Users } from "lucide-react";
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
  return { title: site ? `Contact ${site.name}` : "Contact" };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  if (!site) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
      <h1 className="text-3xl font-bold">Contact {site.name}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Reach the school directly, or sign in as a student or parent on EduSphere.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {site.address && (
          <Card>
            <CardContent className="flex items-start gap-3 pt-6">
              <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium">Address</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {site.address}
                  {site.city || site.state ? `, ${[site.city, site.state].filter(Boolean).join(", ")}` : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {site.phone && (
          <Card>
            <CardContent className="flex items-start gap-3 pt-6">
              <Phone className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium">Phone</p>
                <a
                  href={`tel:${site.phone}`}
                  className="mt-1 block text-sm text-muted-foreground hover:underline"
                >
                  {site.phone}
                </a>
              </div>
            </CardContent>
          </Card>
        )}
        {site.email && (
          <Card>
            <CardContent className="flex items-start gap-3 pt-6">
              <Mail className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium">Email</p>
                <a
                  href={`mailto:${site.email}`}
                  className="mt-1 block text-sm text-muted-foreground hover:underline"
                >
                  {site.email}
                </a>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="flex items-center gap-2 font-medium">
              <GraduationCap className="size-5" aria-hidden="true" />
              Current students
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Access courses, lessons, assignments and CBT exams through the student portal.
            </p>
            <Button render={<Link href="/auth/login" />}>Student login</Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="flex items-center gap-2 font-medium">
              <Users className="size-5" aria-hidden="true" />
              Parents &amp; guardians
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Follow your child&apos;s results, assignments and attendance term by term.
            </p>
            <Button variant="outline" render={<Link href="/auth/login" />}>
              Parent login
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="mt-8 max-w-2xl text-xs text-muted-foreground">
        For admissions enquiries, visit the{" "}
        <Link href={`/schools/${site.slug}/admissions`} className="underline-offset-2 hover:underline">
          admissions page
        </Link>
        .
      </p>
    </div>
  );
}
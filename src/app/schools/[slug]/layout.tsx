import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SchoolSiteShell } from "@/components/site/school-site-shell";
import { getSchoolSite } from "@/services/school-site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  if (!site) return {};
  return {
    title: site.name,
    description: site.description ?? site.motto ?? undefined,
    openGraph: {
      title: site.name,
      description: site.description ?? site.motto ?? undefined,
      type: "website",
    },
  };
}

export default async function SchoolSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  if (!site) notFound();

  return <SchoolSiteShell site={site}>{children}</SchoolSiteShell>;
}
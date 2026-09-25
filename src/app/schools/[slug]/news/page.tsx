import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { getSchoolSite, getSiteNews } from "@/services/school-site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  return { title: site ? `News at ${site.name}` : "News" };
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  if (!site) notFound();

  const news = await getSiteNews(site.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
      <h1 className="text-3xl font-bold">News</h1>
      <p className="mt-2 text-muted-foreground">Announcements from {site.name}.</p>

      {news.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {news.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{formatDate(item.publishedAt)}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {item.message}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">
          No news published yet. Check back soon.
        </p>
      )}
    </div>
  );
}
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSchoolSite, getSiteGallery } from "@/services/school-site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  return { title: site ? `Gallery at ${site.name}` : "Gallery" };
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getSchoolSite(slug);
  if (!site) notFound();

  const items = await getSiteGallery(site.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
      <h1 className="text-3xl font-bold">Gallery</h1>
      <p className="mt-2 text-muted-foreground">Moments from life at {site.name}.</p>

      {items.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <figure key={item.id} className="group overflow-hidden rounded-xl border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title ?? `${site.name} photo`}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <figcaption className="px-4 py-3">
                {item.title && <p className="text-sm font-medium">{item.title}</p>}
                {item.category && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.category}</p>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">
          No photos published yet. Check back soon.
        </p>
      )}
    </div>
  );
}
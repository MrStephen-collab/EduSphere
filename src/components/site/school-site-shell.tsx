import Link from "next/link";
import { GraduationCap, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import type { SchoolSiteProfile } from "@/services/school-site";

function navLinks(slug: string) {
  return [
    { label: "Home", href: `/schools/${slug}` },
    { label: "About", href: `/schools/${slug}/about` },
    { label: "Academics", href: `/schools/${slug}/academics` },
    { label: "Admissions", href: `/schools/${slug}/admissions` },
    { label: "News", href: `/schools/${slug}/news` },
    { label: "Events", href: `/schools/${slug}/events` },
    { label: "Gallery", href: `/schools/${slug}/gallery` },
    { label: "Contact", href: `/schools/${slug}/contact` },
  ];
}

export function SchoolSiteShell({
  site,
  children,
}: {
  site: SchoolSiteProfile;
  children: React.ReactNode;
}) {
  const links = navLinks(site.slug);

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ "--site-primary": site.colors.primary } as React.CSSProperties}
    >
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href={`/schools/${site.slug}`} className="flex min-w-0 items-center gap-2">
            {site.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={site.logoUrl}
                alt={`${site.name} logo`}
                className="size-9 rounded-lg object-contain"
              />
            ) : (
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: site.colors.primary }}
              >
                <GraduationCap className="size-5" aria-hidden="true" />
              </div>
            )}
            <span className="truncate text-lg font-semibold">{site.name}</span>
          </Link>

          <nav
            className="hidden items-center gap-5 text-sm font-medium text-muted-foreground lg:flex"
            aria-label="School website"
          >
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>

          <Button
            size="sm"
            variant="outline"
            render={<Link href="/auth/login" />}
            className="hidden shrink-0 sm:inline-flex"
          >
            Student login
          </Button>
        </div>

        <nav
          className="flex gap-5 overflow-x-auto px-4 pb-3 text-sm font-medium text-muted-foreground lg:hidden"
          aria-label="School website"
        >
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer
        className="border-t"
        style={{ backgroundColor: site.colors.secondary }}
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-white/90 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <div
                className="flex size-9 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: site.colors.primary }}
              >
                <GraduationCap className="size-5" aria-hidden="true" />
              </div>
              <span className="text-base font-semibold">{site.name}</span>
            </div>
            {site.motto && <p className="mt-3 text-sm text-white/70">{site.motto}</p>}
            <p className="mt-3 text-xs text-white/60">
              A school powered by{" "}
              <Link href="/" className="font-medium text-white underline-offset-2 hover:underline">
                {siteConfig.name}
              </Link>
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-white">Explore</p>
            {links.map((link) => (
              <p key={link.href}>
                <Link href={link.href} className="inline-block text-white/80 hover:text-white">
                  {link.label}
                </Link>
              </p>
            ))}
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-white">Contact</p>
            {site.address && (
              <p className="flex items-start gap-2 text-white/80">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {site.address}
                  {site.city || site.state ? `, ${[site.city, site.state].filter(Boolean).join(", ")}` : ""}
                </span>
              </p>
            )}
            {site.phone && (
              <p className="flex items-center gap-2 text-white/80">
                <Phone className="size-4 shrink-0" aria-hidden="true" />
                <a href={`tel:${site.phone}`} className="hover:text-white">
                  {site.phone}
                </a>
              </p>
            )}
            {site.email && (
              <p className="flex items-center gap-2 text-white/80">
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                <a href={`mailto:${site.email}`} className="hover:text-white">
                  {site.email}
                </a>
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">
          © {new Date().getFullYear()} {site.name} · Student &amp; parent login on{" "}
          <Link href="/auth/login" className="underline-offset-2 hover:underline">
            EduSphere
          </Link>
        </div>
      </footer>
    </div>
  );
}
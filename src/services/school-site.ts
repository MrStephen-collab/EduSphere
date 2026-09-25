import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

// Public site data is served through the remote admin client and each query
// opens a fresh TLS connection here (~500ms each). Cache the resolved site per
// slug so repeat navigations render instantly; school content changes are only
// delayed by the TTL.
const SITE_TTL_MS = 5 * 60 * 1000;
const siteCache = new Map<string, { value: unknown; expiresAt: number }>();

function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = siteCache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return Promise.resolve(hit.value as T);
  }
  return load().then((value) => {
    siteCache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  });
}

export type SchoolSiteProfile = {
  id: string;
  name: string;
  slug: string;
  motto: string | null;
  description: string | null;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  colors: { primary: string; secondary: string; accent: string };
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string; code: string | null }[];
};

export type SiteEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  venue: string | null;
  coverUrl: string | null;
  createdAt: string;
};

export type SiteGalleryItem = {
  id: string;
  title: string | null;
  imageUrl: string;
  category: string | null;
  createdAt: string;
};

export type SiteNewsItem = {
  id: string;
  title: string;
  message: string;
  publishedAt: string;
  createdAt: string;
};

export const getSchoolSite = cache(
  async (slug: string): Promise<SchoolSiteProfile | null> => {
    return cached<SchoolSiteProfile | null>(
      `site:${slug}`,
      SITE_TTL_MS,
      async () => {
        const admin = createAdminClient();

        const { data: school, error } = await admin
          .from("schools")
          .select(
            "id, name, slug, motto, description, logo_url, email, phone, address, city, state",
          )
          .eq("slug", slug)
          .eq("status", "active")
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!school) return null;

        const [brandingRes, classesRes, subjectsRes] = await Promise.all([
          admin
            .from("school_branding")
            .select("primary_color, secondary_color, accent_color")
            .eq("school_id", school.id)
            .maybeSingle(),
          admin
            .from("classes")
            .select("id, name")
            .eq("school_id", school.id)
            .order("order", { ascending: true }),
          admin
            .from("subjects")
            .select("id, name, code")
            .eq("school_id", school.id)
            .order("name", { ascending: true }),
        ]);

        return {
          id: school.id,
          name: school.name,
          slug: school.slug,
          motto: school.motto,
          description: school.description,
          logoUrl: school.logo_url,
          email: school.email,
          phone: school.phone,
          address: school.address,
          city: school.city,
          state: school.state,
          colors: {
            primary: brandingRes.data?.primary_color ?? "#2563eb",
            secondary: brandingRes.data?.secondary_color ?? "#334155",
            accent: brandingRes.data?.accent_color ?? "#0ea5e9",
          },
          classes: (classesRes.data ?? []) as { id: string; name: string }[],
          subjects: (subjectsRes.data ?? []) as {
            id: string;
            name: string;
            code: string | null;
          }[],
        };
      },
    );
  },
);

export const getSiteEvents = cache(async (schoolId: string): Promise<SiteEvent[]> => {
  return cached<SiteEvent[]>(`events:${schoolId}`, SITE_TTL_MS, async () => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("school_events")
      .select("id, title, description, starts_at, ends_at, venue, cover_url, created_at")
      .eq("school_id", schoolId)
      .eq("published", true)
      .order("starts_at", { ascending: false });
    if (!data) return [];

    return (data as Array<{
      id: string;
      title: string;
      description: string | null;
      starts_at: string | null;
      ends_at: string | null;
      venue: string | null;
      cover_url: string | null;
      created_at: string;
    }>).map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      venue: e.venue,
      coverUrl: e.cover_url,
      createdAt: e.created_at,
    }));
  });
});

export const getSiteGallery = cache(async (schoolId: string): Promise<SiteGalleryItem[]> => {
  return cached<SiteGalleryItem[]>(`gallery:${schoolId}`, SITE_TTL_MS, async () => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("school_gallery")
      .select("id, title, image_url, category, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
    if (!data) return [];

    return data.map((g) => ({
      id: g.id,
      title: g.title,
      imageUrl: g.image_url,
      category: g.category,
      createdAt: g.created_at,
    }));
  });
});

export const getSiteNews = cache(async (schoolId: string): Promise<SiteNewsItem[]> => {
  return cached<SiteNewsItem[]>(`news:${schoolId}`, SITE_TTL_MS, async () => {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data } = await admin
      .from("announcements")
      .select("id, title, message, published_at, created_at, expires_at")
      .eq("school_id", schoolId)
      .eq("target_type", "school")
      .lte("published_at", now)
      .order("created_at", { ascending: false });

    if (!data) return [];

    return (data as Array<{
      id: string;
      title: string;
      message: string;
      published_at: string | null;
      created_at: string;
      expires_at: string | null;
    }>)
      .filter((a) => !a.expires_at || a.expires_at > now)
      .map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        publishedAt: a.published_at ?? a.created_at,
        createdAt: a.created_at,
      }));
  });
});
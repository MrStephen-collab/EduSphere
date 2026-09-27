import { z } from "zod";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSchoolAdmin } from "@/services/shared";
import { asArray } from "@/lib/embed";

export const eventSchema = z.object({
  title: z.string().trim().min(3, "Event title is required").max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  startsAt: z.string().trim().optional().nullable(),
  endsAt: z.string().trim().optional().nullable(),
  venue: z.string().trim().max(200).optional().nullable(),
  coverUrl: z.string().trim().max(600).optional().nullable(),
  published: z.boolean().optional(),
});

export const gallerySchema = z.object({
  title: z.string().trim().max(160).optional().nullable(),
  imageUrl: z.string().trim().min(5, "An image URL is required").max(600),
  category: z.string().trim().max(80).optional().nullable(),
});

export type SchoolEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  venue: string | null;
  coverUrl: string | null;
  published: boolean;
  authorName: string | null;
  createdAt: string;
};

export type GalleryItem = {
  id: string;
  title: string | null;
  imageUrl: string;
  category: string | null;
  createdAt: string;
};

export async function getSchoolEvents(schoolId: string): Promise<SchoolEvent[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("school_events")
    .select(
      "id, title, description, starts_at, ends_at, venue, cover_url, published, created_at, profiles(full_name)",
    )
    .eq("school_id", schoolId)
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
    published: boolean;
    created_at: string;
    profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  }>).map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    venue: e.venue,
    coverUrl: e.cover_url,
    published: e.published,
    authorName: asArray(e.profiles)[0]?.full_name ?? null,
    createdAt: e.created_at,
  }));
}

export async function createEvent(input: z.infer<typeof eventSchema>): Promise<void> {
  const { schoolId, userId } = await requireSchoolAdmin();
  const data = eventSchema.parse(input);
  const admin = createAdminClient();
  const { error } = await admin.from("school_events").insert({
    school_id: schoolId,
    title: data.title,
    description: data.description ?? null,
    starts_at: data.startsAt ?? null,
    ends_at: data.endsAt ?? null,
    venue: data.venue ?? null,
    cover_url: data.coverUrl ?? null,
    published: data.published ?? false,
    created_by: userId,
  });
  if (error) throw new Error("We couldn't create this event.");
}

export async function updateEvent(
  id: string,
  input: z.infer<typeof eventSchema>,
): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();
  const data = eventSchema.parse(input);
  const admin = createAdminClient();
  const { error } = await admin
    .from("school_events")
    .update({
      title: data.title,
      description: data.description ?? null,
      starts_at: data.startsAt ?? null,
      ends_at: data.endsAt ?? null,
      venue: data.venue ?? null,
      cover_url: data.coverUrl ?? null,
      published: data.published ?? false,
    })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't save this event.");
}

export async function setEventPublished(
  id: string,
  published: boolean,
): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("school_events")
    .update({ published })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't update this event.");
}

export async function deleteEvent(id: string): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("school_events")
    .delete()
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this event.");
}

export async function getSchoolGallery(schoolId: string): Promise<GalleryItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
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
}

export async function addGalleryItem(input: z.infer<typeof gallerySchema>): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();
  const data = gallerySchema.parse(input);
  const admin = createAdminClient();
  const { error } = await admin.from("school_gallery").insert({
    school_id: schoolId,
    title: data.title,
    image_url: data.imageUrl,
    category: data.category,
  });
  if (error) throw new Error("We couldn't add this image.");
}

export async function deleteGalleryItem(id: string): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("school_gallery")
    .delete()
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this image.");
}
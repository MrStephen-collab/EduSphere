import { createAdminClient } from "@/lib/supabase/admin";
import { requireSchoolAdmin } from "@/services/shared";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import { invalidateAuthContexts } from "@/lib/auth/auth-context";
import { sendWelcomeEmail } from "@/email/hooks";
import { z } from "zod";

const schoolBasicsSchema = z.object({
  name: z.string().trim().min(2, "School name is required"),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers or dashes"),
  motto: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  website: z.string().trim().optional().nullable(),
});

export type SchoolBasicsInput = z.infer<typeof schoolBasicsSchema>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Creates a school plus its settings, branding and the owner's role.
 * Trusted server-side path (service role): called during onboarding.
 * The owner is the authenticated user.
 */
export async function createSchoolWithOwner(
  ownerId: string,
  input: SchoolBasicsInput,
): Promise<{ schoolId: string }> {
  invalidateCacheByPrefix("platform:analytics");
  invalidateCacheByPrefix("platform:schools");
  const data = schoolBasicsSchema.parse(input);
  const admin = createAdminClient();

  const slug = data.slug || slugify(data.name);

  const { data: school, error } = await admin
    .from("schools")
    .insert({
      name: data.name,
      slug,
      motto: data.motto ?? null,
      description: data.description ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      website: data.website ?? null,
      status: "active",
      owner_id: ownerId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("That school slug is already taken. Try another name.");
    }
    throw new Error("We couldn't create your school. Please try again.");
  }

  const schoolId = school.id;

  const { error: settingsError } = await admin.from("school_settings").insert({
    school_id: schoolId,
  });
  if (settingsError) {
    throw new Error("We couldn't configure your school settings.");
  }

  const { error: brandingError } = await admin.from("school_branding").insert({
    school_id: schoolId,
  });
  if (brandingError) {
    throw new Error("We couldn't set up your school branding.");
  }

  const { error: roleError } = await admin.from("user_roles").insert({
    school_id: schoolId,
    user_id: ownerId,
    role: "SCHOOL_OWNER",
  });
  if (roleError) {
    throw new Error("We couldn't assign your school owner role.");
  }

  invalidateAuthContexts(ownerId);

  await sendWelcomeEmail({
    ownerUserId: ownerId,
    schoolName: data.name,
  });

  return { schoolId };
}

export async function ensureSchoolSession(schoolId: string) {
  invalidateCacheByPrefix("platform:analytics");
  invalidateCacheByPrefix("dash:school-counts:");
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("academic_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if (existing && existing.length > 0) return;

  const year = new Date().getFullYear();
  const name = `${year}/${year + 1}`;

  const { data: sessionData, error } = await admin
    .from("academic_sessions")
    .insert({ school_id: schoolId, name, is_current: true })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const terms = ["First Term", "Second Term", "Third Term"];
  const { error: termsError } = await admin.from("terms").insert(
    terms.map((name, i) => ({
      school_id: schoolId,
      session_id: sessionData.id,
      name,
      is_current: i === 0,
    })),
  );
  if (termsError) throw new Error(termsError.message);
}

export async function getSchoolOverview(schoolId: string) {
  const admin = createAdminClient();
  const [schoolRes, sessionRes, classRes, subjectRes] = await Promise.all([
    admin.from("schools").select("*").eq("id", schoolId).single(),
    admin
      .from("academic_sessions")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_current", true)
      .maybeSingle(),
    admin.from("classes").select("id").eq("school_id", schoolId).limit(1),
    admin.from("subjects").select("id").eq("school_id", schoolId).limit(1),
  ]);
  return {
    school: schoolRes.data,
    currentSession: sessionRes.data,
    hasClasses: !!classRes.data,
    hasSubjects: !!subjectRes.data,
  };
}

export async function updateBranding(input: {
  name?: string;
  motto?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  website?: string;
}) {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  const { error: schoolError } = await admin.from("schools").update({
    name: input.name ?? undefined,
    motto: input.motto ?? undefined,
    email: input.email ?? undefined,
    phone: input.phone ?? undefined,
    address: input.address ?? undefined,
    city: input.city ?? undefined,
    state: input.state ?? undefined,
    website: input.website ?? undefined,
  }).eq("id", schoolId);
  if (schoolError) throw new Error("We couldn't update your school details.");

  const { error: brandingError } = await admin
    .from("school_branding")
    .upsert(
      {
        school_id: schoolId,
        primary_color: input.primaryColor ?? "#2563eb",
        secondary_color: input.secondaryColor ?? "#334155",
        accent_color: input.accentColor ?? "#0ea5e9",
      },
      { onConflict: "school_id" },
    );
  if (brandingError) throw new Error("We couldn't update your branding.");
}
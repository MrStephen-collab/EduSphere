import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/services/billing";
import { getServerData, invalidateCacheByPrefix } from "@/lib/server-cache";
import { asArray } from "@/lib/embed";
import { EDUCATION_LEVELS, isEducationLevel } from "@/lib/education/levels";
import type { EducationLevel } from "@/types/database";
import { z } from "zod";

function invalidatePlatformCache() {
  invalidateCacheByPrefix("platform:schools");
  invalidateCacheByPrefix("platform:analytics");
}

export const schoolStatusSchema = z.enum([
  "active",
  "pending",
  "suspended",
  "inactive",
]);

export type PlatformSchoolStatus = z.infer<typeof schoolStatusSchema>;

export type PlatformSchoolRow = {
  id: string;
  name: string;
  slug: string;
  educationLevel: EducationLevel | null;
  status: string;
  motto: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  archived: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  students: number;
  teachers: number;
  subscriptionStatus: string;
  planId: string | null;
  planName: string | null;
  periodEnd: string | null;
  createdAt: string;
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/**
 * What a platform admin may change about somebody else's school.
 *
 * The slug is deliberately absent. It is part of the school's identity in
 * links and email, so a super admin editing a typo in a name has no business
 * breaking every bookmark and invite that points at the old slug.
 */
export const platformSchoolEditSchema = z.object({
  name: z.string().trim().min(2, "School name is required").max(160),
  educationLevel: z
    .union([z.enum(EDUCATION_LEVELS.map((level) => level.value) as [string, ...string[]]), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  motto: optionalText(200),
  description: optionalText(2000),
  email: optionalText(160),
  phone: optionalText(40),
  address: optionalText(240),
  city: optionalText(80),
  state: optionalText(80),
  website: optionalText(200),
});

export type PlatformSchoolEditInput = z.infer<
  typeof platformSchoolEditSchema
>;

export async function getPlatformSchools(): Promise<PlatformSchoolRow[]> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  return getServerData("platform:schools", 30_000, async () => {
    const [schoolsRes, studentsRes, teachersRes, subsRes] = await Promise.all([
    admin
      .from("schools")
      .select(
        "id, name, slug, status, education_level, motto, description, email, phone, address, city, state, website, deleted_at, created_at, profiles!schools_owner_id_fkey(full_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("students").select("school_id"),
    admin.from("teachers").select("school_id"),
    admin
      .from("subscriptions")
      .select(
        "school_id, plan_id, status, current_period_end, subscription_plans(name)",
      )
      .order("created_at", { ascending: false }),
  ]);

  const studentCount = new Map<string, number>();
  for (const s of (studentsRes.data ?? []) as { school_id: string }[]) {
    studentCount.set(s.school_id, (studentCount.get(s.school_id) ?? 0) + 1);
  }
  const teacherCount = new Map<string, number>();
  for (const t of (teachersRes.data ?? []) as { school_id: string }[]) {
    teacherCount.set(t.school_id, (teacherCount.get(t.school_id) ?? 0) + 1);
  }

  const subBySchool = new Map<
    string,
    {
      status: string;
      current_period_end: string | null;
      plan_id: string | null;
      planName: string | null;
    }
  >();
  const subRows = (subsRes.data ?? []) as {
    school_id: string;
    plan_id: string | null;
    status: string;
    current_period_end: string | null;
    subscription_plans: { name: string } | { name: string }[] | null;
  }[];
  for (const s of subRows) {
    if (!subBySchool.has(s.school_id)) {
      subBySchool.set(s.school_id, {
        status: s.status,
        current_period_end: s.current_period_end,
        plan_id: s.plan_id,
        planName: asArray(s.subscription_plans)[0]?.name ?? null,
      });
    }
  }

  return ((schoolsRes.data ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    education_level: string | null;
    motto: string | null;
    description: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    website: string | null;
    deleted_at: string | null;
    created_at: string;
    profiles: { full_name: string | null; email: string | null }[] | null;
  }>).map((s) => {
    const sub = subBySchool.get(s.id);
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      educationLevel: isEducationLevel(s.education_level) ? s.education_level : null,
      status: s.status,
      motto: s.motto,
      description: s.description,
      email: s.email,
      phone: s.phone,
      address: s.address,
      city: s.city,
      state: s.state,
      website: s.website,
      archived: s.deleted_at != null,
      ownerName: asArray(s.profiles)[0]?.full_name ?? null,
      ownerEmail: asArray(s.profiles)[0]?.email ?? null,
      students: studentCount.get(s.id) ?? 0,
      teachers: teacherCount.get(s.id) ?? 0,
      subscriptionStatus: sub?.status ?? "inactive",
      planId: sub?.plan_id ?? null,
      planName: sub?.planName ?? null,
      periodEnd: sub?.current_period_end ?? null,
      createdAt: s.created_at,
    };
  });
  });
}

/**
 * Edits a school's own details on the owner's behalf.
 *
 * Only the descriptive fields are editable. The owner keeps their slug, their
 * status and their billing, so a support agent fixing a wrong phone number
 * cannot quietly hand a school a new identity or a new plan.
 */
export async function platformUpdateSchool(
  id: string,
  input: unknown,
): Promise<void> {
  await requirePlatformAdmin();
  const data = platformSchoolEditSchema.parse(input);
  const admin = createAdminClient();
  const { educationLevel, ...fields } = data;
  const { error } = await admin
    .from("schools")
    .update({ ...fields, education_level: educationLevel })
    .eq("id", id);
  if (error) throw new Error("We couldn't update that school.");
  invalidatePlatformCache();
}

/**
 * Moves a school between pending, active and suspended.
 *
 * Status is load-bearing here rather than cosmetic: auth-context only resolves
 * a user's membership when the school is active (auth-context.ts), so setting
 * "suspended" signs every one of the school's users out of their school at
 * once, and setting "active" lets them back in.
 */
export async function platformSetSchoolStatus(
  id: string,
  status: PlatformSchoolStatus,
): Promise<void> {
  await requirePlatformAdmin();
  const parsed = schoolStatusSchema.parse(status);
  const admin = createAdminClient();
  const { error } = await admin
    .from("schools")
    .update({ status: parsed })
    .eq("id", id);
  if (error) throw new Error("We couldn't change that school's status.");
  invalidatePlatformCache();
}

/**
 * Sets which portal level a school runs at, on the owner's behalf.
 *
 * The level is not cosmetic: it decides whether teachers get the Courses and
 * Lessons menus, what classes are called, and whether classes group under a
 * department. A super admin sets it for a school that never declared one, or
 * corrects one that declared wrong. `null` clears it back to the secondary
 * default the app assumes for an unset school.
 */
export async function platformSetSchoolLevel(
  id: string,
  level: EducationLevel | null,
): Promise<void> {
  await requirePlatformAdmin();
  if (level !== null && !isEducationLevel(level)) {
    throw new Error("Choose a valid portal level.");
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("schools")
    .update({ education_level: level })
    .eq("id", id);
  if (error) throw new Error("We couldn't change that school's portal level.");
  invalidatePlatformCache();
}

/**
 * Archives a school.
 *
 * This is the same soft delete the rest of the product uses (courses, lessons
 * and materials all set deleted_at rather than dropping rows): a school holds
 * every student record that has ever been entered against it, and "delete"
 * from a support console should not be the one irreversible button in the
 * product. Archiving signs the school out, stops it appearing in listings and
 * keeps the data on hand; restoring brings it straight back.
 *
 * The confirmation is the school's own name, typed out, so nobody archives a
 * school by muscle memory.
 */
export async function platformArchiveSchool(
  id: string,
  confirmation: string,
): Promise<void> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data: school, error: readError } = await admin
    .from("schools")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new Error("We couldn't find that school.");
  if (!school) throw new Error("We couldn't find that school.");
  if (confirmation.trim().toLowerCase() !== school.name.trim().toLowerCase()) {
    throw new Error("Type the school's name exactly to confirm.");
  }

  const { error } = await admin
    .from("schools")
    .update({ deleted_at: new Date().toISOString(), status: "inactive" })
    .eq("id", id);
  if (error) throw new Error("We couldn't archive that school.");
  invalidatePlatformCache();
}

/**
 * Brings an archived school back.
 *
 * It returns as active: archiving forced the status to inactive, so the
 * status it held before archiving is gone, and an admin who chose to bring a
 * school back has said it should be running again. They can suspend it again
 * afterwards if that was the intent.
 */
export async function platformRestoreSchool(id: string): Promise<void> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("schools")
    .update({ deleted_at: null, status: "active" })
    .eq("id", id);
  if (error) throw new Error("We couldn't restore that school.");
  invalidatePlatformCache();
}

/**
 * Permanently deletes a school and everything under it.
 *
 * This is the one irreversible button in the product. Every table that carries a
 * school_id references it `on delete cascade`, so classes, students, results,
 * courses, invoices and the school's own audit rows go with it in one
 * transaction. There is no bin to restore from.
 *
 * Archiving is the normal way to part with a school — it keeps every record.
 * Deleting exists for the junk: an abandoned signup, or the throwaway schools a
 * verification harness leaves behind. The confirmation is the school's own name
 * typed out, exactly as archiving asks, so nobody drops a live school by muscle
 * memory.
 */
export async function platformDeleteSchool(
  id: string,
  confirmation: string,
): Promise<void> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data: school, error: readError } = await admin
    .from("schools")
    .select("name, slug")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new Error("We couldn't find that school.");
  if (!school) throw new Error("We couldn't find that school.");
  if (confirmation.trim().toLowerCase() !== school.name.trim().toLowerCase()) {
    throw new Error("Type the school's name exactly to confirm.");
  }

  const { error } = await admin.from("schools").delete().eq("id", id);
  if (error) throw new Error("We couldn't delete that school.");

  // The row is gone, so record what it was from the values read above rather
  // than pointing at the school that no longer exists.
  await admin.from("audit_logs").insert({
    user_id: null,
    school_id: null,
    action: "school_deleted",
    entity_type: "schools",
    entity_id: id,
    metadata: { name: school.name, slug: school.slug, source: "platform_console" },
  });
  invalidatePlatformCache();
}

export type PlatformAnalytics = {
  totalSchools: number;
  activeSchools: number;
  pendingSchools: number;
  totalStudents: number;
  totalTeachers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  annualRevenue: number;
  planDistribution: { label: string; count: number }[];
  recentSchools: { id: string; name: string; status: string; createdAt: string }[];
};

export async function getPlatformAnalytics(): Promise<PlatformAnalytics> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  return getServerData("platform:analytics", 30_000, async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

  const [
    totalRes,
    activeRes,
    pendingRes,
    studentsRes,
    teachersRes,
    subsRes,
    paidRes,
    schoolsRes,
  ] = await Promise.all([
    admin
      .from("schools")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    admin
      .from("schools")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("deleted_at", null),
    admin
      .from("schools")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("deleted_at", null),
    admin.from("students").select("id", { count: "exact", head: true }),
    admin.from("teachers").select("id", { count: "exact", head: true }),
    admin
      .from("subscriptions")
      .select("subscription_plans(name)")
      .eq("status", "active"),
    admin.from("payments").select("amount, paid_at").eq("status", "paid"),
    admin
      .from("schools")
      .select("id, name, status, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  let monthlyRevenue = 0;
  let annualRevenue = 0;
  for (const p of (paidRes.data ?? []) as { amount: number; paid_at: string | null }[]) {
    if (!p.paid_at) continue;
    const amount = Number(p.amount);
    if (p.paid_at >= monthStart) monthlyRevenue += amount;
    if (p.paid_at >= yearStart) annualRevenue += amount;
  }

  const planCount = new Map<string, number>();
  for (const s of (subsRes.data ?? []) as {
    subscription_plans: { name: string } | { name: string }[] | null;
  }[]) {
    const label = asArray(s.subscription_plans)[0]?.name ?? "No plan";
    planCount.set(label, (planCount.get(label) ?? 0) + 1);
  }
  const planDistribution = [...planCount.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalSchools: totalRes.count ?? 0,
    activeSchools: activeRes.count ?? 0,
    pendingSchools: pendingRes.count ?? 0,
    totalStudents: studentsRes.count ?? 0,
    totalTeachers: teachersRes.count ?? 0,
    activeSubscriptions: subsRes.data?.length ?? 0,
    monthlyRevenue,
    annualRevenue,
    planDistribution,
    recentSchools: ((schoolsRes.data ?? []) as {
      id: string;
      name: string;
      status: string;
      created_at: string;
    }[]).map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      createdAt: s.created_at,
    })),
  };
  });
}

export type SupportTicket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  schoolName: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  createdAt: string;
};

export async function getSupportTickets(): Promise<SupportTicket[]> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("support_tickets")
    .select("*, schools(name), profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{
    id: string;
    subject: string;
    message: string;
    status: string;
    priority: string;
    created_at: string;
    schools: { name: string }[] | null;
    profiles: { full_name: string | null; email: string | null }[] | null;
  }>).map((t) => ({
    id: t.id,
    subject: t.subject,
    message: t.message,
    status: t.status,
    priority: t.priority,
    schoolName: asArray(t.schools)[0]?.name ?? null,
    reporterName: asArray(t.profiles)[0]?.full_name ?? null,
    reporterEmail: asArray(t.profiles)[0]?.email ?? null,
    createdAt: t.created_at,
  }));
}

export async function setSupportTicketStatus(id: string, status: string): Promise<void> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("support_tickets")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error("We couldn't update the ticket.");
}

export type PlatformUser = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  memberships: { schoolId: string; schoolName: string; role: string }[];
};

export const USER_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  SCHOOL_OWNER: "Owner",
  SCHOOL_ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

export function userRoleLabel(role: string): string {
  return USER_ROLE_LABELS[role] ?? role;
}

export async function getPlatformUsers(): Promise<PlatformUser[]> {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const [profilesRes, rolesRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, phone, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("user_roles")
      .select("user_id, school_id, role, schools(name)")
      .order("created_at", { ascending: true }),
  ]);

  const rolesByUser = new Map<string, { schoolId: string; schoolName: string; role: string }[]>();
  for (const r of (rolesRes.data ?? []) as {
    user_id: string;
    school_id: string | null;
    role: string;
    schools: { name: string }[] | null;
  }[]) {
    if (!r.user_id) continue;
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push({
      schoolId: r.school_id ?? "",
      schoolName: r.school_id ? (asArray(r.schools)[0]?.name ?? "School") : "Platform",
      role: r.role,
    });
    rolesByUser.set(r.user_id, list);
  }

  return ((profilesRes.data ?? []) as Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    created_at: string;
  }>).map((p) => ({
    id: p.id,
    fullName: p.full_name ?? "Unnamed user",
    email: p.email,
    phone: p.phone,
    avatarUrl: p.avatar_url,
    createdAt: p.created_at,
    memberships: rolesByUser.get(p.id) ?? [],
  }));
}
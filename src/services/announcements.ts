import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSchoolAdmin } from "@/services/shared";
import { fanOutAnnouncement } from "@/services/notifications";
import { sendAnnouncementEmails } from "@/email/hooks";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import type {
  Announcement,
  AnnouncementTarget,
  UserRoleName,
} from "@/types/database";

function invalidateAnnouncementDashboards() {
  invalidateCacheByPrefix("dash:teacher:");
  invalidateCacheByPrefix("dash:student:");
  invalidateCacheByPrefix("dash:parent-children:");
}

const targetSchema = z.enum(["school", "class", "students", "teachers", "parents"]);

const dateOrNull = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date and time")
  .nullable()
  .optional();

export const announcementInputSchema = z
  .object({
    title: z.string().trim().min(2, "A title is required"),
    message: z.string().trim().min(2, "A message is required"),
    targetType: targetSchema,
    classId: z.string().trim().min(1).nullable().optional(),
    publishedAt: dateOrNull,
    expiresAt: dateOrNull,
  })
  .superRefine((value, ctx) => {
    if (value.targetType === "class" && !value.classId) {
      ctx.addIssue({
        code: "custom",
        path: ["classId"],
        message: "Choose which class this announcement is for",
      });
    }
  });

export type AnnouncementInput = z.infer<typeof announcementInputSchema>;

export type AnnouncementRow = Announcement & {
  classes: { id: string; name: string } | null;
  author: { full_name: string } | null;
};

async function logAudit(opts: {
  schoolId: string;
  action: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { context } = await requireSchoolAdmin();
  const user = context.user;
  if (!user) return;
  await createAdminClient().from("audit_logs").insert({
    school_id: opts.schoolId,
    user_id: user.id,
    action: opts.action,
    entity_type: "announcements",
    entity_id: opts.entityId,
    metadata: opts.metadata ?? {},
  });
}

/**
 * Admin-facing list of every announcement for the school, newest first,
 * with the target class name and the author's display name.
 */
export async function getAnnouncements(schoolId: string): Promise<AnnouncementRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(
      "*, classes(id, name), author:profiles!announcements_created_by_fkey(full_name)",
    )
    .eq("school_id", schoolId)
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AnnouncementRow[];
}

export async function createAnnouncement(input: AnnouncementInput): Promise<void> {
  invalidateAnnouncementDashboards();
  const { schoolId, userId } = await requireSchoolAdmin();
  const data = announcementInputSchema.parse(input);
  const admin = createAdminClient();

  const clean = {
    school_id: schoolId,
    title: data.title,
    message: data.message,
    target_type: data.targetType as AnnouncementTarget,
    class_id:
      data.targetType === "class" ? (data.classId ?? null) : null,
    published_at: data.publishedAt ?? new Date().toISOString(),
    expires_at: data.expiresAt ?? null,
    created_by: userId,
  };

  const { data: created, error } = await admin
    .from("announcements")
    .insert(clean)
    .select("id")
    .single();
  if (error) throw new Error("We couldn't publish this announcement.");

  await fanOutAnnouncement({
    schoolId,
    title: data.title,
    message: data.message,
    targetType: data.targetType as AnnouncementTarget,
    classId: clean.class_id,
    excludeUserId: userId,
  });

  await sendAnnouncementEmails({
    schoolId,
    title: data.title,
    message: data.message,
    targetType: data.targetType as AnnouncementTarget,
    classId: clean.class_id,
  });

  await logAudit({
    schoolId,
    action: "announcement_created",
    entityId: created.id,
    metadata: { title: data.title, target: data.targetType },
  });
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput,
): Promise<void> {
  invalidateAnnouncementDashboards();
  const { schoolId } = await requireSchoolAdmin();
  const data = announcementInputSchema.parse(input);
  const admin = createAdminClient();

  const clean = {
    title: data.title,
    message: data.message,
    target_type: data.targetType as AnnouncementTarget,
    class_id:
      data.targetType === "class" ? (data.classId ?? null) : null,
    published_at: data.publishedAt ?? new Date().toISOString(),
    expires_at: data.expiresAt ?? null,
  };

  const { error } = await admin
    .from("announcements")
    .update(clean)
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't update this announcement.");

  await logAudit({
    schoolId,
    action: "announcement_updated",
    entityId: id,
    metadata: { title: data.title, target: data.targetType },
  });
}

export async function deleteAnnouncement(id: string): Promise<void> {
  invalidateAnnouncementDashboards();
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("announcements")
    .delete()
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this announcement.");

  await logAudit({
    schoolId,
    action: "announcement_deleted",
    entityId: id,
  });
}

/**
 * Active announcements a given audience should see on their dashboard.
 * Includes school-wide posts, role-targeted posts, and posts for the
 * caller's classes. Future-scheduled and expired announcements are excluded.
 */
export async function getRelevantAnnouncements(input: {
  schoolId: string;
  roles: UserRoleName[];
  classIds?: string[];
}): Promise<Announcement[]> {
  const supabase = await createSupabaseServerClient();
  const roles = new Set(input.roles);

  const targets: AnnouncementTarget[] = ["school"];
  if (
    roles.has("TEACHER") ||
    roles.has("SCHOOL_OWNER") ||
    roles.has("SCHOOL_ADMIN") ||
    roles.has("PRINCIPAL")
  ) {
    targets.push("teachers");
  }
  if (roles.has("PARENT")) targets.push("parents");
  if (roles.has("STUDENT")) targets.push("students");

  const now = new Date().toISOString();
  const orParts = targets.map((t) => `target_type.eq.${t}`);

  const classIds = (input.classIds ?? []).filter(Boolean);
  if (classIds.length > 0) {
    orParts.push(
      `and(target_type.eq.class,class_id.in.(${classIds.join(",")}))`,
    );
  }

  const query = supabase
    .from("announcements")
    .select("*")
    .eq("school_id", input.schoolId)
    .lte("published_at", now)
    .or(orParts.join(","))
    .or("expires_at.is.null,expires_at.gt." + now)
    .order("published_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Announcement[];
}

export async function getStudentAnnouncements(
  schoolId: string,
  studentId: string,
): Promise<Announcement[]> {
  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  return getRelevantAnnouncements({
    schoolId,
    roles: ["STUDENT"],
    classIds: student?.class_id ? [student.class_id] : [],
  });
}

export async function getParentAnnouncements(
  schoolId: string,
  parentId: string,
): Promise<Announcement[]> {
  const supabase = await createSupabaseServerClient();
  const { data: links } = await supabase
    .from("parent_student_relationships")
    .select("students!inner(class_id)")
    .eq("school_id", schoolId)
    .eq("parent_id", parentId);

  const classIds = [
    ...new Set(
      (links ?? [])
        .flatMap((l) => l.students.map((s) => s.class_id))
        .filter((c): c is string => !!c),
    ),
  ];

  return getRelevantAnnouncements({
    schoolId,
    roles: ["PARENT"],
    classIds,
  });
}

export async function getTeacherAnnouncements(
  schoolId: string,
  teacherId: string,
): Promise<Announcement[]> {
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("teacher_classes")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId);

  const classIds = (rows ?? [])
    .map((r) => r.class_id)
    .filter((c): c is string => !!c);

  return getRelevantAnnouncements({
    schoolId,
    roles: ["TEACHER"],
    classIds,
  });
}
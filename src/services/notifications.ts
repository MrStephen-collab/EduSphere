import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificationTypeLabel } from "@/lib/notification-labels";
import type {
  AnnouncementTarget,
  Notification,
} from "@/types/database";

export type NotificationView = Notification & {
  schoolName: string | null;
};

export { notificationTypeLabel };

export async function getNotifications(
  userId: string,
): Promise<{ items: NotificationView[]; unreadCount: number; now: number }> {
  const supabase = await createSupabaseServerClient();

  const [itemsRes, unreadRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("*, schools(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
  ]);

  const raw = (itemsRes.data ?? []) as (Notification & {
    schools: { name: string }[] | null;
  })[];
  const items: NotificationView[] = raw.map((n) => ({
    ...n,
    schoolName: n.schools?.[0]?.name ?? null,
  }));

  return { items, unreadCount: unreadRes.count ?? 0, now: Date.now() };
}

const UNREAD_TTL_MS = 30_000;
const unreadCache = new Map<string, { value: number; expiresAt: number }>();

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const cached = unreadCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  const value = count ?? 0;
  unreadCache.set(userId, { value, expiresAt: Date.now() + UNREAD_TTL_MS });
  return value;
}

export async function markNotificationsRead(
  userId: string,
  ids?: string[],
): Promise<void> {
  const admin = createAdminClient();
  let query = admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (ids && ids.length > 0) query = query.in("id", ids);
  const { error } = await query;
  if (error) throw new Error("We couldn't update your notifications.");
  unreadCache.delete(userId);
}

// ---------------------------------------------------------------------------
// Announcement fan-out
// ---------------------------------------------------------------------------

export async function resolveAnnouncementRecipients(input: {
  schoolId: string;
  targetType: AnnouncementTarget;
  classId: string | null;
}): Promise<{ user_id: string; role: string | null }[]> {
  const admin = createAdminClient();
  const { schoolId, targetType, classId } = input;

  let userRows: { user_id: string }[] = [];

  if (targetType === "class" && classId) {
    const [studentsRes, parentsRes] = await Promise.all([
      admin
        .from("students")
        .select("user_id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .not("user_id", "is", null),
      admin
        .from("students")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_id", classId),
    ]);

    const studentUserIds = (studentsRes.data ?? []) as { user_id: string }[];

    const classStudentIds = (parentsRes.data ?? []).map(
      (s) => (s as { id: string }).id,
    );
    const parentIds = new Set<string>();
    if (classStudentIds.length > 0) {
      const { data: links } = await admin
        .from("parent_student_relationships")
        .select("parents(user_id)")
        .eq("school_id", schoolId)
        .in("student_id", classStudentIds);
      for (const r of (links ?? []) as {
        parents: { user_id: string }[] | null;
      }[]) {
        const userId = r.parents?.[0]?.user_id;
        if (userId) parentIds.add(userId);
      }
    }
    userRows = [...studentUserIds, ...[...parentIds].map((user_id) => ({ user_id }))];
  } else {
    const roleByTarget: Record<string, string> = {
      students: "STUDENT",
      teachers: "TEACHER",
      parents: "PARENT",
    };
    let query = admin.from("user_roles").select("user_id, role");
    if (targetType === "school") {
      query = query.eq("school_id", schoolId);
    } else {
      query = query
        .eq("school_id", schoolId)
        .eq("role", roleByTarget[targetType] ?? "STUDENT");
    }
    const { data } = await query;
    userRows = (data ?? []) as { user_id: string; role: string }[];
  }

  if (targetType === "class") {
    const ids = userRows.map((r) => r.user_id);
    if (ids.length > 0) {
      const { data: roleRows } = await admin
        .from("user_roles")
        .select("user_id, role")
        .eq("school_id", schoolId)
        .in("user_id", ids);
      const roleById = new Map(
        (roleRows ?? []).map((r) => [
          (r as { user_id: string }).user_id,
          (r as { role: string }).role ?? null,
        ]),
      );
      return userRows.map((r) => ({
        user_id: r.user_id,
        role: roleById.get(r.user_id) ?? null,
      }));
    }
  }

  return userRows.map((r) => ({
    user_id: r.user_id,
    role: (r as { role?: string }).role ?? null,
  }));
}

export async function fanOutAnnouncement(input: {
  schoolId: string;
  title: string;
  message: string;
  targetType: AnnouncementTarget;
  classId: string | null;
  excludeUserId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { schoolId, title, message, targetType, excludeUserId } = input;

  const resolved = await resolveAnnouncementRecipients({
    schoolId,
    targetType,
    classId: input.classId,
  });
  const userRows = resolved.map((r) => ({ user_id: r.user_id }));

  const recipients = [
    ...new Set(userRows.map((r) => r.user_id).filter((id) => id !== excludeUserId)),
  ];
  if (recipients.length === 0) return;

  const rows = recipients.map((userId) => ({
    user_id: userId,
    school_id: schoolId,
    type: "announcement" as const,
    title,
    message,
  }));

  const { error } = await admin.from("notifications").insert(rows);
  if (error) throw new Error("We couldn't send notifications for this announcement.");
}
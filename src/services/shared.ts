import { redirect } from "next/navigation";
import { getAuthContext, type AuthContext } from "@/lib/auth/auth-context";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export type SchoolAdminContext = {
  context: AuthContext;
  userId: string;
  schoolId: string;
  schoolName: string;
};

const MANAGER_ROLES = ["SCHOOL_OWNER", "SCHOOL_ADMIN"] as const;

/**
 * Resolves the caller's active school membership and enforces that they are a
 * school manager (owner or admin). Redirects to the school dashboard otherwise.
 * Everything created through the returned context is scoped to `schoolId`.
 */
export async function requireSchoolAdmin(): Promise<SchoolAdminContext> {
  const context = await getAuthContext();

  if (!context.user) {
    redirect("/auth/login");
  }

  const membership = context.memberships.find((m) =>
    MANAGER_ROLES.includes(m.role as (typeof MANAGER_ROLES)[number]),
  );

  if (!membership) {
    redirect("/school");
  }

  return {
    context,
    userId: context.user.id,
    schoolId: membership.school.id,
    schoolName: membership.school.name,
  };
}

/**
 * Resolves any school membership (any role) for a given route.
 */
export async function requireAnySchoolMember() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  if (context.memberships.length === 0) redirect("/school");
  return {
    ...context,
    membership: context.memberships[0],
    schoolId: context.memberships[0].school.id,
    schoolName: context.memberships[0].school.name,
  };
}

export function isManagerRole(
  role: string | null | undefined,
): role is (typeof MANAGER_ROLES)[number] {
  return !!role && (MANAGER_ROLES as readonly string[]).includes(role);
}

const CONTENT_EDITOR_ROLES = ["SCHOOL_OWNER", "SCHOOL_ADMIN", "TEACHER"] as const;

export type ContentEditorContext = SchoolAdminContext & {
  teacherId: string | null;
  role: (typeof CONTENT_EDITOR_ROLES)[number];
};

/**
 * Resolves a school membership that is allowed to author learning content
 * (owner, admin or teacher) and returns the caller's teacher record id when
 * they are a teacher (null for school managers).
 */
export async function requireContentEditor(): Promise<ContentEditorContext> {
  const context = await getAuthContext();

  if (!context.user) {
    redirect("/auth/login");
  }

  const membership = context.memberships.find((m) =>
    (CONTENT_EDITOR_ROLES as readonly string[]).includes(m.role),
  );

  if (!membership) {
    redirect("/dashboard");
  }

  const teacherId =
    membership.role === "TEACHER" ? await resolveTeacherId(membership.school.id, context.user.id) : null;

  return {
    context,
    userId: context.user.id,
    schoolId: membership.school.id,
    schoolName: membership.school.name,
    teacherId,
    role: membership.role as (typeof CONTENT_EDITOR_ROLES)[number],
  };
}

async function resolveTeacherId(schoolId: string, userId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("teachers")
    .select("id")
    .eq("school_id", schoolId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}
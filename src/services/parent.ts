import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export type ParentContext = {
  schoolId: string;
  schoolName: string;
  parentId: string;
  userId: string;
};

export async function requireParent(): Promise<ParentContext> {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");

  const membership = context.memberships.find((m) => m.role === "PARENT");
  if (!membership) redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("parents")
    .select("id")
    .eq("school_id", membership.school.id)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (!data) redirect("/dashboard");

  return {
    schoolId: membership.school.id,
    schoolName: membership.school.name,
    parentId: data.id,
    // Callers that write as the signed-in user (complaints, replies) need the
    // auth id, not the parents-table id: the rows they touch are keyed on it.
    userId: context.user.id,
  };
}

export type ParentChild = {
  studentId: string;
  displayName: string;
  admissionNumber: string;
  className: string | null;
  streamName: string | null;
  gender: string | null;
};

export async function getParentChildren(
  schoolId: string,
  parentId: string,
): Promise<ParentChild[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("parent_student_relationships")
    .select(
      "student_id, students!inner(id, admission_number, display_name, gender, classes(name), streams(name))",
    )
    .eq("school_id", schoolId)
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).flatMap((r) => {
    const students = Array.isArray(r.students) ? r.students : r.students ? [r.students] : [];
    return students.map((s) => {
      const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
      const strm = Array.isArray(s.streams) ? s.streams[0] : s.streams;
      return {
        studentId: s.id,
        displayName: s.display_name ?? "Student",
        admissionNumber: s.admission_number,
        className: cls?.name ?? null,
        streamName: strm?.name ?? null,
        gender: s.gender,
      };
    });
  });
}

export function resolveChild(
  children: ParentChild[],
  childId: string | null | undefined,
): ParentChild | null {
  return children.find((c) => c.studentId === childId) ?? children[0] ?? null;
}
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export type ClassRosterStudent = {
  id: string;
  displayName: string | null;
  admissionNumber: string;
  gender: string | null;
};

export type TeacherClassRoster = {
  classId: string;
  className: string;
  students: ClassRosterStudent[];
};

export async function getTeacherClassRosters(
  schoolId: string,
  teacherId: string | null,
): Promise<TeacherClassRoster[]> {
  const supabase = await createSupabaseServerClient();

  if (!teacherId) return [];

  const { data: links } = await supabase
    .from("teacher_classes")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId);

  const classIds = (links ?? []).map((l) => l.class_id).filter(Boolean);
  if (classIds.length === 0) return [];

  const [classesRes, studentsRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", schoolId)
      .in("id", classIds)
      .order("order", { ascending: true }),
    supabase
      .from("students")
      .select("id, display_name, admission_number, gender, class_id")
      .eq("school_id", schoolId)
      .in("class_id", classIds)
      .order("admission_number", { ascending: true }),
  ]);

  const byClass = new Map<string, ClassRosterStudent[]>();
  for (const s of (studentsRes.data ?? []) as Array<{
    id: string;
    display_name: string | null;
    admission_number: string;
    gender: string | null;
    class_id: string | null;
  }>) {
    if (!s.class_id) continue;
    const list = byClass.get(s.class_id) ?? [];
    list.push({
      id: s.id,
      displayName: s.display_name,
      admissionNumber: s.admission_number,
      gender: s.gender,
    });
    byClass.set(s.class_id, list);
  }

  return ((classesRes.data ?? []) as { id: string; name: string }[]).map(
    (c) => ({
      classId: c.id,
      className: c.name,
      students: byClass.get(c.id) ?? [],
    }),
  );
}
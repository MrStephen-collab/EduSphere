import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { asArray } from "@/lib/embed";

export type StudentProfile = {
  displayName: string;
  admissionNumber: string;
  className: string | null;
  streamName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  guardianPhone: string | null;
};

export type ParentProfile = {
  displayName: string;
  relationship: string | null;
};

export async function getStudentProfile(
  schoolId: string,
  studentId: string,
): Promise<StudentProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("students")
    .select(
      "display_name, admission_number, gender, date_of_birth, guardian_phone, classes(name), streams(name)",
    )
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .maybeSingle();
  if (!data) return null;

  return {
    displayName: data.display_name ?? "Student",
    admissionNumber: data.admission_number,
    className: asArray(data.classes)[0]?.name ?? null,
    streamName: asArray(data.streams)[0]?.name ?? null,
    gender: data.gender,
    dateOfBirth: data.date_of_birth,
    guardianPhone: data.guardian_phone,
  };
}

export async function getParentProfile(
  schoolId: string,
  parentId: string,
): Promise<ParentProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("parents")
    .select("display_name, relationship")
    .eq("school_id", schoolId)
    .eq("id", parentId)
    .maybeSingle();
  if (!data) return null;

  return {
    displayName: data.display_name ?? "Parent",
    relationship: data.relationship,
  };
}
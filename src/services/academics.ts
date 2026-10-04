import { z } from "zod";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSchoolAdmin } from "@/services/shared";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import type {
  AcademicSession,
  Department,
  SchoolClass,
  SchoolStream,
  Subject,
  Term,
} from "@/types/database";
import { getSchoolLevel } from "@/services/schools";
import { getLevelDefinition } from "@/lib/education/levels";

function invalidateSchoolCounts() {
  invalidateCacheByPrefix("dash:school-counts:");
}

export const classNameSchema = z.object({
  name: z.string().trim().min(2, "Class name is required").max(40),
  order: z.coerce.number().int().min(0).optional().default(0),
  departmentId: z.string().uuid().optional().nullable(),
  programme: z.string().trim().max(20).optional().nullable(),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Department name is required").max(80),
});

export const subjectSchema = z.object({
  name: z.string().trim().min(2, "Subject name is required").max(60),
  code: z.string().trim().max(10).optional().nullable(),
});

export const streamSchema = z.object({
  name: z.string().trim().min(1, "Stream name is required").max(10),
});

export const sessionSchema = z.object({
  name: z.string().trim().min(6, "Session must look like 2026/2027").max(20),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const termSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().trim().min(2, "Term name is required"),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
});

export async function getClasses(schoolId: string): Promise<SchoolClass[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("school_id", schoolId)
    .order("order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createClass(input: {
  name: string;
  order?: number;
  departmentId?: string | null;
  programme?: string | null;
}): Promise<void> {
  invalidateSchoolCounts();
  const { schoolId } = await requireSchoolAdmin();
  const parsed = classNameSchema.parse(input);
  const departmentId = parsed.departmentId ?? null;
  // Programmes belong to polytechnic only. Sending one for another level is a
  // caller mistake worth surfacing rather than storing a value nothing reads.
  if (parsed.programme) {
    const level = await getSchoolLevel(schoolId);
    if (getLevelDefinition(level).programmes.length === 0) {
      throw new Error(
        `Programmes are a polytechnic concept; this school is ${getLevelDefinition(level).label.toLowerCase()}.`,
      );
    }
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("classes").insert({
    school_id: schoolId,
    name: parsed.name,
    order: parsed.order ?? 0,
    department_id: departmentId,
    programme: parsed.programme ?? null,
  });
  if (error) {
    if (error.code === "23505") throw new Error("That class already exists.");
    if (error.code === "23503") {
      throw new Error("That department does not belong to this school.");
    }
    throw new Error("We couldn't create this class.");
  }
}

/**
 * Departments (college, polytechnic) and faculties (university).
 *
 * Readable by any member because a teacher labels a course with one, and
 * writable only by a school manager, matching subjects.
 */
export async function getDepartments(schoolId: string): Promise<Department[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createDepartment(input: { name: string }): Promise<void> {
  invalidateSchoolCounts();
  const { schoolId } = await requireSchoolAdmin();
  const parsed = departmentSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("departments").insert({
    school_id: schoolId,
    name: parsed.name,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("That department already exists.");
    }
    throw new Error("We couldn't create this department.");
  }
}

export async function deleteDepartment(id: string): Promise<void> {
  invalidateSchoolCounts();
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createSupabaseServerClient();

  // The foreign keys on classes and courses are ON DELETE SET NULL, so deleting
  // the department already leaves the classes and courses in place, ungrouped.
  // Clearing them explicitly first keeps that behaviour if the columns are ever
  // changed to RESTRICT, and gives a definite failure here rather than a
  // constraint error mid-delete.
  for (const table of ["classes", "courses"] as const) {
    const { error: clearError } = await supabase
      .from(table)
      .update({ department_id: null })
      .eq("department_id", id)
      .eq("school_id", schoolId);
    if (clearError) {
      throw new Error("We couldn't remove this department from its classes.");
    }
  }

  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this department.");
}

export async function deleteClass(id: string): Promise<void> {
  invalidateSchoolCounts();
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this class.");
}

export async function getSubjects(schoolId: string): Promise<Subject[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSubject(input: {
  name: string;
  code?: string | null;
}): Promise<void> {
  invalidateSchoolCounts();
  const { schoolId } = await requireSchoolAdmin();
  const parsed = subjectSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("subjects").insert({
    school_id: schoolId,
    name: parsed.name,
    code: parsed.code ?? null,
  });
  if (error) {
    if (error.code === "23505") throw new Error("That subject already exists.");
    throw new Error("We couldn't create this subject.");
  }
}

export async function deleteSubject(id: string): Promise<void> {
  invalidateSchoolCounts();
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this subject.");
}

export async function getStreams(schoolId: string): Promise<SchoolStream[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("streams")
    .select("*")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createStream(input: { name: string }): Promise<void> {
  invalidateSchoolCounts();
  const { schoolId } = await requireSchoolAdmin();
  const parsed = streamSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("streams").insert({
    school_id: schoolId,
    name: parsed.name,
  });
  if (error) throw new Error("We couldn't create this stream.");
}

export async function getSessions(schoolId: string): Promise<AcademicSession[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("academic_sessions")
    .select("*")
    .eq("school_id", schoolId)
    .order("is_current", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSession(input: {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<void> {
  invalidateSchoolCounts();
  const { schoolId } = await requireSchoolAdmin();
  const parsed = sessionSchema.parse(input);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("academic_sessions")
    .insert({
      school_id: schoolId,
      name: parsed.name,
      start_date: parsed.startDate ?? null,
      end_date: parsed.endDate ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error("We couldn't create this session.");

  const terms = ["First Term", "Second Term", "Third Term"];
  const { error: termsError } = await admin.from("terms").insert(
    terms.map((name) => ({
      school_id: schoolId,
      session_id: data.id,
      name,
    })),
  );
  if (termsError) throw new Error("We couldn't set up this session's terms.");
}

export async function setCurrentSession(sessionId: string): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();
  const { error: clearError } = await admin
    .from("academic_sessions")
    .update({ is_current: false })
    .eq("school_id", schoolId)
    .eq("is_current", true);
  if (clearError) throw new Error("We couldn't update your sessions.");

  const { error } = await admin
    .from("academic_sessions")
    .update({ is_current: true })
    .eq("id", sessionId)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't set the current session.");
}

export async function getTerms(sessionId: string): Promise<Term[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("terms")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Every term in the school, across sessions. Used by fee billing. */
export async function getSchoolTerms(schoolId: string): Promise<Term[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("terms")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setCurrentTerm(termId: string): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();
  const { error: clearError } = await admin
    .from("terms")
    .update({ is_current: false })
    .eq("school_id", schoolId)
    .eq("is_current", true);
  if (clearError) throw new Error("We couldn't update terms.");

  const { error } = await admin
    .from("terms")
    .update({ is_current: true })
    .eq("id", termId)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't set the current term.");
}
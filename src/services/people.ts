import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { requireSchoolAdmin } from "@/services/shared";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import { invalidateAuthContexts } from "@/lib/auth/auth-context";
import type { Parent, Student, Teacher } from "@/types/database";

function invalidatePeopleCounts() {
  invalidateCacheByPrefix("dash:school-counts:");
  invalidateCacheByPrefix("platform:schools");
  invalidateCacheByPrefix("platform:analytics");
}

function defaultPassword(): string {
  return (
    process.env.DEFAULT_ACCOUNT_PASSWORD ||
    process.env.DEMO_USER_PASSWORD ||
    "EduSphere@2026"
  );
}

async function findExistingUserId(email?: string) {
  if (!email) return null;
  const { data } = await createAdminClient()
    .auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    ?.id ?? null;
}

async function createOrGetAuthUser(opts: {
  email?: string | null;
  fullName: string;
}): Promise<string | null> {
  const admin = createAdminClient();

  if (opts.email && opts.email.trim()) {
    const existing = await findExistingUserId(opts.email);
    if (existing) return existing;
    const { data, error } = await admin.auth.admin.createUser({
      email: opts.email.trim(),
      password: defaultPassword(),
      email_confirm: true,
      user_metadata: { full_name: opts.fullName },
    });
    if (error) {
      throw new Error(`We couldn't create the account for ${opts.email}.`);
    }
    return data.user.id;
  }

  return null;
}

async function logAudit(opts: {
  schoolId: string;
  action: string;
  entityType: string;
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
    entity_type: opts.entityType,
    entity_id: opts.entityId,
    metadata: opts.metadata ?? {},
  });
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

export async function createTeacher(input: {
  fullName: string;
  email?: string | null;
  title?: string | null;
}): Promise<void> {
  invalidatePeopleCounts();
  const { schoolId } = await requireSchoolAdmin();

  const admin = createAdminClient();
  const userId = await createOrGetAuthUser({
    email: input.email,
    fullName: input.fullName,
  });

  const { data, error } = await admin
    .from("teachers")
    .insert({
      school_id: schoolId,
      user_id: userId,
      title: input.title ?? null,
      display_name: input.fullName.trim(),
    })
    .select("id")
    .single();
  if (error) throw new Error("We couldn't add this teacher.");

  if (userId) {
    const { error: roleError } = await admin.from("user_roles").insert({
      school_id: schoolId,
      user_id: userId,
      role: "TEACHER",
    });
    if (roleError && roleError.code !== "23505") {
      throw new Error("We couldn't assign the teacher role.");
    }
    invalidateAuthContexts(userId);
  }

  await logAudit({
    schoolId,
    action: "teacher_created",
    entityType: "teachers",
    entityId: data.id,
    metadata: { fullName: input.fullName },
  });
}

export type TeacherRow = Teacher & {
  profile: { full_name: string; email: string | null } | null;
};

export async function getTeachers(schoolId: string): Promise<TeacherRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("*, teacher_profile:profiles!teachers_user_id_fkey(full_name, email)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TeacherRow[];
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export async function createStudent(input: {
  fullName: string;
  email?: string | null;
  admissionNumber: string;
  classId?: string | null;
  streamId?: string | null;
  gender?: "male" | "female" | null;
  dateOfBirth?: string | null;
  guardianPhone?: string | null;
}): Promise<void> {
  invalidatePeopleCounts();
  const { schoolId } = await requireSchoolAdmin();

  const admin = createAdminClient();
  const userId = await createOrGetAuthUser({
    email: input.email,
    fullName: input.fullName,
  });

  const { data, error } = await admin
    .from("students")
    .insert({
      school_id: schoolId,
      user_id: userId,
      admission_number: input.admissionNumber.trim(),
      class_id: input.classId ?? null,
      stream_id: input.streamId ?? null,
      gender: input.gender ?? null,
      date_of_birth: input.dateOfBirth ?? null,
      guardian_phone: input.guardianPhone ?? null,
      display_name: input.fullName.trim(),
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error(
        `Admission number "${input.admissionNumber}" is already in use.`,
      );
    }
    throw new Error("We couldn't add this student.");
  }

  if (userId) {
    const { error: roleError } = await admin.from("user_roles").insert({
      school_id: schoolId,
      user_id: userId,
      role: "STUDENT",
    });
    if (roleError && roleError.code !== "23505") {
      throw new Error("We couldn't assign the student role.");
    }
    invalidateAuthContexts(userId);
  }

  await logAudit({
    schoolId,
    action: "student_created",
    entityType: "students",
    entityId: data.id,
    metadata: { admissionNumber: input.admissionNumber },
  });
}

export type StudentRow = Student & {
  profile: { full_name: string; email: string | null } | null;
  classes: { name: string } | null;
  streams: { name: string } | null;
};

export async function getStudents(
  schoolId: string,
  options?: { search?: string },
): Promise<StudentRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("students")
    .select(
      "*, student_profile:profiles!students_user_id_fkey(full_name, email), classes(name), streams(name)",
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (options?.search) {
    const term = `%${options.search}%`;
    query = query.or(`admission_number.ilike.${term},display_name.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as StudentRow[];
}

export type ImportRow = {
  firstName?: string;
  lastName?: string;
  email?: string;
  admissionNumber: string;
  classIndex?: number | null;
  stream?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
};

export type ImportSummary = {
  created: number;
  duplicates: number;
  errors: string[];
};

/**
 * Bulk-creates student accounts from parsed rows. Skips duplicate admission
 * numbers within the school and reports individual row errors.
 */
export async function importStudents(rows: ImportRow[]): Promise<ImportSummary> {
  invalidatePeopleCounts();
  const { schoolId } = await requireSchoolAdmin();
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("students")
    .select("admission_number")
    .eq("school_id", schoolId);
  if (existingError) throw new Error(existingError.message);

  const seen = new Set((existing ?? []).map((s) => s.admission_number.toLowerCase()));

  let created = 0;
  let duplicates = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const admission = row.admissionNumber?.trim() ?? "";
    if (!admission) {
      errors.push("Row skipped: missing admission number.");
      continue;
    }
    if (seen.has(admission.toLowerCase())) {
      duplicates += 1;
      continue;
    }

    const fullName =
      [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
      admission;

    const userId = await createOrGetAuthUser({
      email: row.email,
      fullName,
    });

    const { error } = await admin
      .from("students")
      .insert({
        school_id: schoolId,
        user_id: userId,
        admission_number: admission,
        gender: row.gender === "male" || row.gender === "female" ? row.gender : null,
        date_of_birth: row.dateOfBirth || null,
        display_name: fullName,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        duplicates += 1;
      } else {
        errors.push(`${admission}: ${error.message}`);
      }
      continue;
    }

    if (userId) {
      await admin.from("user_roles").insert({
        school_id: schoolId,
        user_id: userId,
        role: "STUDENT",
      });
    }

    seen.add(admission.toLowerCase());
    created += 1;
  }

  if (created > 0) {
    invalidateAuthContexts();
  }

  await logAudit({
    schoolId,
    action: "students_imported",
    entityType: "students",
    metadata: { created, duplicates, errorCount: errors.length },
  });

  return { created, duplicates, errors };
}

// ---------------------------------------------------------------------------
// Parents
// ---------------------------------------------------------------------------

export async function createParent(input: {
  fullName: string;
  email?: string | null;
  relationship?: string | null;
  linkedStudentIds: string[];
}): Promise<void> {
  invalidatePeopleCounts();
  const { schoolId } = await requireSchoolAdmin();

  const admin = createAdminClient();
  const userId = await createOrGetAuthUser({
    email: input.email,
    fullName: input.fullName,
  });

  const { data, error } = await admin
    .from("parents")
    .insert({
      school_id: schoolId,
      user_id: userId,
      relationship: input.relationship ?? null,
      display_name: input.fullName.trim(),
    })
    .select("id")
    .single();
  if (error) throw new Error("We couldn't add this parent.");

  if (userId) {
    await admin.from("user_roles").insert({
      school_id: schoolId,
      user_id: userId,
      role: "PARENT",
    });
    invalidateAuthContexts(userId);
  }

  const links = input.linkedStudentIds.map((studentId) => ({
    school_id: schoolId,
    parent_id: data.id,
    student_id: studentId,
  }));

  if (links.length > 0) {
    const { error: linkError } = await admin
      .from("parent_student_relationships")
      .insert(links);
    if (linkError) throw new Error("We couldn't link the children to this parent.");
  }

  await logAudit({
    schoolId,
    action: "parent_created",
    entityType: "parents",
    entityId: data.id,
    metadata: { linkedStudents: input.linkedStudentIds.length },
  });
}

export type ParentRow = Parent & {
  profile: { full_name: string; email: string | null } | null;
};

export async function getParents(schoolId: string): Promise<ParentRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("parents")
    .select("*, parent_profile:profiles!parents_user_id_fkey(full_name, email)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ParentRow[];
}
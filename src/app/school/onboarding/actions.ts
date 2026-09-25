"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/auth-context";
import { parseCsv, mapCsvRows, type CsvMapping } from "@/lib/csv";
import { createSchoolWithOwner, ensureSchoolSession } from "@/services/schools";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createStudent, createTeacher } from "@/services/people";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function errorResult(e: unknown): ActionResult<never> {
  if (typeof e === "object" && e !== null && "digest" in e) {
    throw e;
  }
  const message =
    e instanceof Error ? e.message : "Something went wrong. Please try again.";
  return { ok: false, error: message };
}

async function requireOnboardingUser() {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");
  return context.user;
}

export async function onboardingCreateSchool(input: {
  name: string;
  motto?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  website?: string;
}): Promise<ActionResult<{ schoolId: string }>> {
  try {
    const user = await requireOnboardingUser();
    const slug = input.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const { schoolId } = await createSchoolWithOwner(user.id, {
      ...input,
      slug,
    });
    return { ok: true, data: { schoolId } };
  } catch (e) {
    return errorResult(e);
  }
}

export async function onboardingSaveSession(
  schoolId: string,
): Promise<ActionResult> {
  try {
    await ensureSchoolSession(schoolId);
    return { ok: true, data: undefined };
  } catch (e) {
    return errorResult(e);
  }
}

export async function onboardingSaveClasses(
  schoolId: string,
  names: string[],
): Promise<ActionResult> {
  try {
    const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    if (unique.length === 0) {
      return { ok: false, error: "Add at least one class." };
    }
    const { error } = await createAdminClient()
      .from("classes")
      .insert(
        unique.map((name, i) => ({
          school_id: schoolId,
          name,
          order: i,
        })),
      );
    if (error) return errorResult(error);
    return { ok: true, data: undefined };
  } catch (e) {
    return errorResult(e);
  }
}

export async function onboardingSaveSubjects(
  schoolId: string,
  items: { name: string; code?: string }[],
): Promise<ActionResult> {
  try {
    const seen = new Set<string>();
    const unique = items.filter((item) => {
      const name = item.name.trim();
      if (!name || seen.has(name.toLowerCase())) return false;
      seen.add(name.toLowerCase());
      return true;
    });
    if (unique.length === 0) {
      return { ok: false, error: "Add at least one subject." };
    }
    const { error } = await createAdminClient()
      .from("subjects")
      .insert(
        unique.map((item) => ({
          school_id: schoolId,
          name: item.name.trim(),
          code: item.code?.trim() || null,
        })),
      );
    if (error) return errorResult(error);
    return { ok: true, data: undefined };
  } catch (e) {
    return errorResult(e);
  }
}

const TEACHER_COLUMNS: Record<string, string[]> = {
  fullName: ["full_name", "fullname", "name", "teacher_name"],
  email: ["email", "email_address", "teacher_email"],
  title: ["title"],
};

const STUDENT_COLUMNS: Record<string, string[]> = {
  firstName: ["first_name", "firstname", "given_name"],
  lastName: ["last_name", "lastname", "surname", "family_name"],
  email: ["email", "email_address"],
  admissionNumber: ["admission_number", "admission_no", "adm_no", "reg_no", "registration_number"],
  gender: ["gender", "sex"],
  dateOfBirth: ["date_of_birth", "dob", "birth_date"],
};

async function parsePeopleCsv(
  csvText: string,
  columns: Record<string, string[]>,
): Promise<CsvMapping[]> {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error("The CSV needs a header row and at least one data row.");
  }
  return mapCsvRows(rows, columns);
}

export async function onboardingImportTeachers(
  csvText: string,
): Promise<ActionResult<{ created: number; duplicates: number; errors: string[] }>> {
  try {
    const rows = await parsePeopleCsv(csvText, TEACHER_COLUMNS);
    let created = 0;
    let duplicates = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const fullName = row.fullName || row.email || "Staff";
      if (!row.email && !row.fullName) {
        errors.push("Row skipped: missing name and email.");
        continue;
      }
      try {
        await createTeacher({
          fullName,
          email: row.email || null,
          title: row.title || null,
        });
        created += 1;
      } catch (e) {
        if (e instanceof Error && e.message.includes("already")) {
          duplicates += 1;
        } else {
          errors.push(`${fullName}: ${e instanceof Error ? e.message : "error"}`);
        }
      }
    }

    revalidatePath("/school/teachers");
    return { ok: true, data: { created, duplicates, errors } };
  } catch (e) {
    return errorResult(e);
  }
}

export async function onboardingImportStudents(
  csvText: string,
): Promise<ActionResult<{ created: number; duplicates: number; errors: string[] }>> {
  try {
    const rows = await parsePeopleCsv(csvText, STUDENT_COLUMNS);
    if (rows.length === 0) {
      return { ok: false, error: "No students found in the CSV." };
    }

    let created = 0;
    let duplicates = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        await createStudent({
          fullName: `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || row.admissionNumber,
          email: row.email || null,
          admissionNumber: row.admissionNumber || crypto.randomUUID().slice(0, 8),
          gender: row.gender as "male" | "female" | null,
          dateOfBirth: row.dateOfBirth || null,
        });
        created += 1;
      } catch (e) {
        if (e instanceof Error) {
          if (e.message.includes("already in use")) {
            duplicates += 1;
          } else {
            errors.push(`${row.admissionNumber || "unknown"}: ${e.message}`);
          }
        } else {
          errors.push(`${row.admissionNumber || "unknown"}: error`);
        }
      }
    }

    revalidatePath("/school/students");
    return { ok: true, data: { created, duplicates, errors } };
  } catch (e) {
    return errorResult(e);
  }
}

export async function completeOnboarding(schoolId: string): Promise<ActionResult> {
  try {
    await ensureSchoolSession(schoolId);
    revalidatePath("/school");
  } catch (e) {
    return errorResult(e);
  }
  redirect(`/school?welcome=1`);
}

export { isSupabaseConfigured };
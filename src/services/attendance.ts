import type { AttendanceRecord, AttendanceStatus } from "@/types/database";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireContentEditor } from "@/services/shared";
import { ATTENDANCE_STATUSES } from "@/lib/attendance-labels";
import { asArray } from "@/lib/embed";

export type ClassRegisterEntry = {
  studentId: string;
  admissionNumber: string;
  displayName: string;
  streamName: string | null;
  status: AttendanceStatus | null;
};

export type ClassRegister = {
  date: string;
  entries: ClassRegisterEntry[];
};

type RegisterStudentRow = {
  id: string;
  admission_number: string;
  display_name: string | null;
  user_id: string | null;
  streams: { name: string } | { name: string }[] | null;
};

type RegisterRecordRow = Pick<AttendanceRecord, "student_id" | "status">;

function todayKey(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function assertTeacherCanMark(
  schoolId: string,
  classId: string,
  teacherId: string | null,
): Promise<void> {
  if (!teacherId) return;
  const supabase = await createSupabaseServerClient();
  const { data: link } = await supabase
    .from("teacher_classes")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .eq("class_id", classId)
    .maybeSingle();
  if (!link) throw new Error("This class isn't assigned to you.");
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getClassRegister(
  schoolId: string,
  classId: string,
  date: string,
  teacherId: string | null,
): Promise<ClassRegister | null> {
  if (!isDateKey(date)) return null;

  const supabase = await createSupabaseServerClient();
  const { data: cls } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!cls) return null;

  if (teacherId) await assertTeacherCanMark(schoolId, classId, teacherId);

  const { data: students } = await supabase
    .from("students")
    .select("id, admission_number, display_name, user_id, streams(name)")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("admission_number", { ascending: true });
  const studentRows = (students ?? []) as unknown as RegisterStudentRow[];

  const studentIds = studentRows.map((s) => s.id);
  const { data: records } =
    studentIds.length > 0
      ? await supabase
          .from("attendance_records")
          .select("student_id, status")
          .eq("school_id", schoolId)
          .eq("class_id", classId)
          .eq("date", date)
          .in("student_id", studentIds)
      : { data: null };
  const statusByStudent = new Map<string, AttendanceStatus>(
    ((records ?? []) as RegisterRecordRow[]).map((r) => [r.student_id, r.status]),
  );

  return {
    date,
    entries: studentRows.map((s) => ({
      studentId: s.id,
      admissionNumber: s.admission_number,
      displayName: s.display_name ?? "Student",
      streamName: asArray(s.streams)[0]?.name ?? null,
      status: statusByStudent.get(s.id) ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const attendanceEntrySchema = {
  studentId: (value: unknown): value is string =>
    typeof value === "string" && /^[0-9a-f-]{36}$/.test(value),
  status: (value: unknown): value is AttendanceStatus =>
    typeof value === "string" &&
    (ATTENDANCE_STATUSES as string[]).includes(value),
};

export async function saveClassRegister(
  classId: string,
  date: string,
  entries: { studentId: string; status: string }[],
): Promise<void> {
  const { schoolId, userId, role, teacherId } = await requireContentEditor();
  if (role !== "TEACHER" && role !== "SCHOOL_ADMIN" && role !== "SCHOOL_OWNER") {
    throw new Error("Only school staff can take attendance.");
  }
  if (!isDateKey(date)) throw new Error("Please pick a valid date.");
  if (date > todayKey()) throw new Error("Attendance for a future date isn't allowed.");
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("Mark at least one student.");
  }
  for (const e of entries) {
    if (!attendanceEntrySchema.studentId(e?.studentId)) {
      throw new Error("One of the students couldn't be recognised.");
    }
    if (!attendanceEntrySchema.status(e?.status)) {
      throw new Error("One of the attendance marks is invalid.");
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data: cls } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!cls) throw new Error("This class doesn't exist in your school.");

  if (role === "TEACHER") await assertTeacherCanMark(schoolId, classId, teacherId);

  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .in(
      "id",
      entries.map((e) => e.studentId),
    );
  const knownIds = new Set((students ?? []).map((s: { id: string }) => s.id));
  for (const e of entries) {
    if (!knownIds.has(e.studentId)) {
      throw new Error("One of the students isn't enrolled in this class.");
    }
  }

  const now = new Date().toISOString();
  const rows = entries.map((e) => ({
    school_id: schoolId,
    class_id: classId,
    student_id: e.studentId,
    date,
    status: e.status,
    marked_by: userId,
    updated_at: now,
  }));

  const admin = createAdminClient();
  const { error } = await admin
    .from("attendance_records")
    .upsert(rows, { onConflict: "student_id,date" });
  if (error) throw new Error("We couldn't save the register.");
}
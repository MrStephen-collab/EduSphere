import { z } from "zod";
import type { TimetableDay, TimetableEntry, TimetablePeriod } from "@/types/database";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { rowExists } from "@/lib/supabase/queries";
import { asArray } from "@/lib/embed";
import { requireContentEditor, requireSchoolAdmin } from "@/services/shared";
import { requireStudent } from "@/services/learning";
import { TIMETABLE_DAYS } from "@/lib/timetable-labels";

export { TIMETABLE_DAYS };

export type TimetableOption = { id: string; label: string };

export type TimetableCell = {
  entryId: string;
  day: TimetableDay;
  periodId: string;
  subjectId: string | null;
  subjectName: string | null;
  teacherId: string | null;
  teacherName: string | null;
};

export type TimetableGrid = {
  classId: string;
  sessionId: string;
  periods: TimetablePeriod[];
  cells: TimetableCell[];
  /** Only populated for editors; a student's grid carries names, not pickers. */
  subjectOptions: TimetableOption[];
  teacherOptions: TimetableOption[];
};

type EntryRow = {
  id: string;
  period_id: string;
  day_of_week: number;
  subject_id: string | null;
  teacher_id: string | null;
  subjects: { name: string } | { name: string }[] | null;
  teachers: { display_name: string | null } | { display_name: string | null }[] | null;
};

function oneName(value: { name: string } | { name: string }[] | null): string | null {
  const row = asArray(value as { name: string } | null)[0];
  return row?.name ?? null;
}

function oneDisplayName(
  value: { display_name: string | null } | { display_name: string | null }[] | null,
): string | null {
  const row = asArray(value as { display_name: string | null } | null)[0];
  return row?.display_name ?? null;
}

/**
 * A teacher editing a cell in a class they are not assigned to is the mistake
 * this message exists for. RLS already refuses it; without the check the cell
 * would simply appear to save and then vanish on reload, which reads like a
 * bug in the app rather than a refusal by the database.
 */
async function assertTeacherCanEdit(
  schoolId: string,
  classId: string,
  teacherId: string | null,
): Promise<void> {
  if (!teacherId) return;
  const supabase = await createSupabaseServerClient();
  const linked = await rowExists(supabase, "teacher_classes", {
    school_id: schoolId,
    teacher_id: teacherId,
    class_id: classId,
  });
  if (!linked) throw new Error("This class isn't assigned to you.");
}

async function assertBelongsToSchool(
  table: "classes" | "subjects" | "teachers" | "timetable_periods",
  id: string,
  schoolId: string,
  label: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const found = await rowExists(supabase, table, { id, school_id: schoolId });
  if (!found) throw new Error(`That ${label} isn't part of this school.`);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getTimetablePeriods(schoolId: string): Promise<TimetablePeriod[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("timetable_periods")
    .select("*")
    .eq("school_id", schoolId)
    .order("seq", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TimetablePeriod[];
}

/**
 * One class's week: the school's periods down the side, six days across, and
 * whatever has actually been entered in the cells. Empty cells are absent from
 * `cells` rather than present and blank, because a timetable that has never been
 * filled in and one that has been cleared to nothing are the same thing to show.
 */
export async function getTimetableGrid(input: {
  schoolId: string;
  sessionId: string;
  classId: string;
  withOptions?: boolean;
}): Promise<TimetableGrid> {
  const { schoolId, sessionId, classId, withOptions = false } = input;
  const supabase = await createSupabaseServerClient();

  const [periodsResult, entriesResult] = await Promise.all([
    supabase
      .from("timetable_periods")
      .select("*")
      .eq("school_id", schoolId)
      .order("seq", { ascending: true }),
    supabase
      .from("timetable_entries")
      .select(
        "id, period_id, day_of_week, subject_id, teacher_id, subjects(name), teachers(display_name)",
      )
      .eq("school_id", schoolId)
      .eq("session_id", sessionId)
      .eq("class_id", classId),
  ]);

  if (periodsResult.error) throw new Error(periodsResult.error.message);
  if (entriesResult.error) throw new Error(entriesResult.error.message);

  const cells: TimetableCell[] = ((entriesResult.data ?? []) as unknown as EntryRow[]).map(
    (row) => ({
      entryId: row.id,
      day: row.day_of_week as TimetableDay,
      periodId: row.period_id,
      subjectId: row.subject_id,
      subjectName: oneName(row.subjects),
      teacherId: row.teacher_id,
      teacherName: oneDisplayName(row.teachers),
    }),
  );

  let subjectOptions: TimetableOption[] = [];
  let teacherOptions: TimetableOption[] = [];

  if (withOptions) {
    const [subjectsResult, teachersResult] = await Promise.all([
      supabase.from("subjects").select("id, name").eq("school_id", schoolId).order("name"),
      supabase
        .from("teachers")
        .select("id, display_name, title")
        .eq("school_id", schoolId)
        .order("display_name"),
    ]);
    if (subjectsResult.error) throw new Error(subjectsResult.error.message);
    if (teachersResult.error) throw new Error(teachersResult.error.message);

    subjectOptions = (subjectsResult.data ?? []).map((s) => ({ id: s.id, label: s.name }));
    teacherOptions = ((teachersResult.data ?? []) as {
      id: string;
      display_name: string | null;
      title: string | null;
    }[]).map((t) => ({
      id: t.id,
      label: [t.title, t.display_name].filter(Boolean).join(" ") || "Unnamed teacher",
    }));
  }

  return {
    classId,
    sessionId,
    periods: (periodsResult.data ?? []) as TimetablePeriod[],
    cells,
    subjectOptions,
    teacherOptions,
  };
}

/**
 * The student's own week. Resolved from the student's enrolment rather than a
 * parameter, because a student choosing which class to look at is a class
 * choosing what to show them.
 *
 * Returns null when the student has no class or the school has no timetable
 * periods, which are two different problems for the caller to word differently.
 */
export async function getStudentTimetable(): Promise<{
  grid: TimetableGrid;
  className: string | null;
} | null> {
  const { schoolId, studentId } = await requireStudent();
  const supabase = await createSupabaseServerClient();

  const { data: student } = await supabase
    .from("students")
    .select("class_id, classes(name)")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  const classId = (student as { class_id: string | null } | null)?.class_id ?? null;
  if (!classId) return null;

  const { data: session } = await supabase
    .from("academic_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle();

  const sessionId = (session as { id: string } | null)?.id;
  if (!sessionId) return null;

  const grid = await getTimetableGrid({ schoolId, sessionId, classId });
  if (!grid.periods.length) return null;

  const className = oneName(
    (student as { classes: { name: string } | { name: string }[] | null } | null)?.classes ?? null,
  );

  return { grid, className };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const cellSchema = z.object({
  classId: z.string().uuid("Pick a class."),
  sessionId: z.string().uuid(),
  dayOfWeek: z.coerce.number().int().min(1).max(6),
  periodId: z.string().uuid(),
  subjectId: z.string().uuid("Pick a subject."),
  teacherId: z.string().uuid().nullable(),
});

export const timetableCellSchema = cellSchema;
export const timetableClearSchema = cellSchema.pick({ classId: true, sessionId: true, dayOfWeek: true, periodId: true });

const periodSchema = z
  .object({
    name: z.string().trim().min(1, "Give the period a name.").max(24),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be HH:MM."),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time must be HH:MM."),
    isBreak: z.boolean().optional().default(false),
  })
  .refine((v) => v.endTime > v.startTime, {
    message: "The period must end after it starts.",
    path: ["endTime"],
  });

export const timetablePeriodSchema = periodSchema;

/**
 * A teacher cannot be in two classes at once, and the timetable is where a
 * school discovers that it has promised them that. The unique constraint on
 * (class, session, day, period) already stops one class being double-booked,
 * but a teacher double-booked across two classes is not a uniqueness problem
 * and has to be asked about explicitly.
 */
async function assertTeacherFree(
  schoolId: string,
  sessionId: string,
  classId: string,
  teacherId: string,
  dayOfWeek: number,
  periodId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("timetable_entries")
    .select("id, classes(name)")
    .eq("school_id", schoolId)
    .eq("session_id", sessionId)
    .eq("teacher_id", teacherId)
    .eq("day_of_week", dayOfWeek)
    .eq("period_id", periodId)
    .neq("class_id", classId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return;

  const clash = oneName(
    (data as { classes: { name: string } | { name: string }[] | null }).classes,
  );
  throw new Error(
    `That teacher is already teaching ${clash ?? "another class"} in this period.`,
  );
}

export async function saveTimetableCell(input: unknown): Promise<void> {
  const editor = await requireContentEditor();
  const parsed = cellSchema.parse(input);

  await assertTeacherCanEdit(editor.schoolId, parsed.classId, editor.teacherId);
  await assertBelongsToSchool("classes", parsed.classId, editor.schoolId, "class");
  await assertBelongsToSchool("timetable_periods", parsed.periodId, editor.schoolId, "period");
  await assertBelongsToSchool("subjects", parsed.subjectId, editor.schoolId, "subject");
  if (parsed.teacherId) {
    await assertBelongsToSchool("teachers", parsed.teacherId, editor.schoolId, "teacher");
    await assertTeacherFree(
      editor.schoolId,
      parsed.sessionId,
      parsed.classId,
      parsed.teacherId,
      parsed.dayOfWeek,
      parsed.periodId,
    );
  }

  const supabase = await createSupabaseServerClient();
  const row: Partial<TimetableEntry> = {
    school_id: editor.schoolId,
    session_id: parsed.sessionId,
    class_id: parsed.classId,
    period_id: parsed.periodId,
    day_of_week: parsed.dayOfWeek,
    subject_id: parsed.subjectId,
    teacher_id: parsed.teacherId,
  };

  const { error } = await supabase
    .from("timetable_entries")
    .upsert(row, { onConflict: "class_id,session_id,day_of_week,period_id" });

  if (error) {
    if (error.code === "23505") {
      throw new Error("That period already has a lesson for this class.");
    }
    throw new Error("We couldn't save this lesson.");
  }
}

export async function clearTimetableCell(input: unknown): Promise<void> {
  const editor = await requireContentEditor();
  const parsed = timetableClearSchema.parse(input);
  await assertTeacherCanEdit(editor.schoolId, parsed.classId, editor.teacherId);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("timetable_entries")
    .delete()
    .eq("school_id", editor.schoolId)
    .eq("session_id", parsed.sessionId)
    .eq("class_id", parsed.classId)
    .eq("day_of_week", parsed.dayOfWeek)
    .eq("period_id", parsed.periodId);

  if (error) throw new Error("We couldn't clear this lesson.");
}

// ---------------------------------------------------------------------------
// Periods
//
// Admin only. The shape of the school day is a decision the timetable makes on
// behalf of every class, so a teacher editing one class's grid must not be able
// to move the bell.
// ---------------------------------------------------------------------------

export async function createTimetablePeriod(input: unknown): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();
  const parsed = periodSchema.parse(input);

  const supabase = await createSupabaseServerClient();
  const { data: last } = await supabase
    .from("timetable_periods")
    .select("seq")
    .eq("school_id", schoolId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  const seq = ((last as { seq: number } | null)?.seq ?? -1) + 1;

  const { error } = await supabase.from("timetable_periods").insert({
    school_id: schoolId,
    name: parsed.name,
    start_time: parsed.startTime,
    end_time: parsed.endTime,
    seq,
    is_break: parsed.isBreak,
  });

  if (error) {
    if (error.code === "23505") throw new Error("That position in the day is taken.");
    throw new Error("We couldn't add this period.");
  }
}

export async function deleteTimetablePeriod(id: string): Promise<void> {
  const { schoolId } = await requireSchoolAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("timetable_periods")
    .delete()
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't remove this period.");
}

import { z } from "zod";
import type {
  AttendanceStatus,
  LiveAttendanceRecord,
  LiveSession,
  LiveSessionStatus,
} from "@/types/database";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowExists } from "@/lib/supabase/queries";
import { asArray } from "@/lib/embed";
import { requireContentEditor } from "@/services/shared";
import { requireStudent } from "@/services/learning";
import { isAcceptableJoinUrl } from "@/lib/live-labels";

export type LiveSessionView = {
  id: string;
  title: string;
  description: string | null;
  joinUrl: string;
  startsAt: string;
  endsAt: string | null;
  status: LiveSessionStatus;
  isVisibleToStudents: boolean;
  classId: string;
  className: string | null;
  courseName: string | null;
  subjectName: string | null;
  lessonTitle: string | null;
  /**
 * This student's own mark on the session, when a teacher has taken the register.
 * Null means unmarked, which is different from marked absent, so it is not
 * collapsed to a default.
 */
  myAttendance: AttendanceStatus | null;
};

/**
 * `courses(title, subjects(name))` is a two-level embed: a course belongs to a
 * subject, and PostgREST will not follow that in one hop. The subject name is
 * worth the nesting because a student scanning for "which subject is live" is
 * looking for Mathematics, not for the course's title.
 */
type CourseEmbed =
  | { title: string; subjects: { name: string } | { name: string }[] | null }
  | { title: string; subjects: { name: string } | { name: string }[] | null }[]
  | null;

type SessionRow = LiveSession & {
  classes: { name: string } | { name: string }[] | null;
  courses: CourseEmbed;
  lessons: { title: string } | { title: string }[] | null;
};

function embedName(value: { name: string } | { name: string }[] | null): string | null {
  return asArray(value as { name: string } | null)[0]?.name ?? null;
}

function embedTitle(value: { title: string } | { title: string }[] | null): string | null {
  return asArray(value as { title: string } | null)[0]?.title ?? null;
}

function toView(row: SessionRow): LiveSessionView {
  const course = asArray(row.courses)[0] ?? null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    joinUrl: row.join_url,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    isVisibleToStudents: row.is_visible_to_students,
    classId: row.class_id,
    className: embedName(row.classes),
    courseName: course?.title ?? null,
    subjectName: course ? embedName(course.subjects) : null,
    lessonTitle: embedTitle(row.lessons),
    myAttendance: null,
  };
}

const SESSION_SELECT =
  "id, school_id, class_id, course_id, lesson_id, title, description, join_url, starts_at, ends_at, status, is_visible_to_students, created_by, created_at, updated_at, classes(name), courses(title, subjects(name)), lessons(title)";

/**
 * A teacher may only announce a lesson to a class they are assigned to, so the
 * class list a caller may write to is the same list they are shown. RLS refuses
 * the write regardless; this exists so the picker cannot offer something that
 * will not save.
 */
async function assertTeacherCanAnnounce(
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

async function assertSchoolOwnsClass(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  classId: string,
): Promise<void> {
  const owned = await rowExists(supabase, "classes", { id: classId, school_id: schoolId });
  if (!owned) throw new Error("That class doesn't belong to your school.");
}

async function assertSchoolOwnsCourse(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  courseId: string,
): Promise<void> {
  const owned = await rowExists(supabase, "courses", { id: courseId, school_id: schoolId });
  if (!owned) throw new Error("That course doesn't belong to your school.");
}

async function assertSchoolOwnsLesson(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  lessonId: string,
): Promise<void> {
  const owned = await rowExists(supabase, "lessons", { id: lessonId, school_id: schoolId });
  if (!owned) throw new Error("That lesson doesn't belong to your school.");
}

async function lessonCourseId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  lessonId: string,
): Promise<string | null> {
  const { data } = await supabase.from("lessons").select("course_id").eq("id", lessonId).maybeSingle();
  return (data?.course_id as string | null) ?? null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Everything an editor may see, including sessions not yet announced. */
export async function getSchoolLiveSessions(schoolId: string): Promise<LiveSessionView[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("live_sessions")
    .select(SESSION_SELECT)
    .eq("school_id", schoolId)
    .order("starts_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as SessionRow[]).map((row) => toView(row));
}

/**
 * A teacher's own live teaching, across the classes assigned to them, with the
 * register for whichever session is selected.
 */
export async function getTeacherLiveSessions(input: {
  schoolId: string;
  teacherId: string | null;
  sessionId?: string | null;
}): Promise<{ sessions: LiveSessionView[]; register: LiveAttendanceRegister | null }> {
  const { schoolId, teacherId, sessionId } = input;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("live_sessions")
    .select(SESSION_SELECT)
    .eq("school_id", schoolId)
    .order("starts_at", { ascending: false });

  if (error) throw new Error(error.message);
  const sessions = ((data ?? []) as unknown as SessionRow[]).map((row) => toView(row));

  if (!teacherId) {
    // A manager browsing this page has no single class to register, so the
    // register stays null rather than showing another teacher's class roll.
    return { sessions, register: null };
  }

  const allowed = new Set<string>();
  const { data: links } = await supabase
    .from("teacher_classes")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId);
  for (const link of links ?? []) allowed.add(link.class_id as string);

  const mine = sessions.filter((s) => allowed.has(s.classId));
  const selected = mine.find((s) => s.id === sessionId) ?? mine[0] ?? null;
  const register = selected ? await getLiveAttendanceRegister(selected.id) : null;

  return { sessions: mine, register };
}

export type LiveAttendanceEntry = {
  studentId: string;
  displayName: string;
  admissionNumber: string;
  status: AttendanceStatus | null;
};

export type LiveAttendanceRegister = {
  sessionId: string;
  entries: LiveAttendanceEntry[];
};

export async function getLiveAttendanceRegister(
  liveSessionId: string,
): Promise<LiveAttendanceRegister> {
  const supabase = await createSupabaseServerClient();

  const { data: marks, error: marksError } = await supabase
    .from("live_attendance_records")
    .select("student_id, status")
    .eq("live_session_id", liveSessionId);
  if (marksError) throw new Error(marksError.message);

  const byStudent = new Map(
    ((marks ?? []) as Pick<LiveAttendanceRecord, "student_id" | "status">[]).map((m) => [
      m.student_id,
      m.status,
    ]),
  );

  const { data: session } = await supabase
    .from("live_sessions")
    .select("class_id")
    .eq("id", liveSessionId)
    .maybeSingle();

  const classId = (session as { class_id: string } | null)?.class_id;
  if (!classId) return { sessionId: liveSessionId, entries: [] };

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, display_name, admission_number")
    .eq("class_id", classId)
    .order("admission_number", { ascending: true });
  if (studentsError) throw new Error(studentsError.message);

  return {
    sessionId: liveSessionId,
    entries: ((students ?? []) as {
      id: string;
      display_name: string | null;
      admission_number: string;
    }[]).map((s) => ({
      studentId: s.id,
      displayName: s.display_name ?? "Unnamed student",
      admissionNumber: s.admission_number,
      status: byStudent.get(s.id) ?? null,
    })),
  };
}

/**
 * A student's live teaching: what has been announced to their class, and the
 * mark on each one. RLS already hides unannounced sessions and sessions for
 * other classes, so this resolves the class rather than filtering those out
 * here.
 *
 * Cancelled sessions are dropped here rather than in the client component,
 * which is not a matter of tidiness. Whatever a server component returns to a
 * client component is serialised into the page as props, so a session kept in
 * the array reaches the browser even when nothing renders it. Filtering after
 * that point hides a title but still ships it. A cancelled session is a teacher's
 * private note that the lesson is not happening, so it should never be read by
 * a class in the first place.
 */
export async function getStudentLiveSessions(): Promise<LiveSessionView[]> {
  const { schoolId, studentId } = await requireStudent();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("live_sessions")
    .select(SESSION_SELECT)
    .eq("school_id", schoolId)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: false });
  if (error) throw new Error(error.message);

  const sessions = ((data ?? []) as unknown as SessionRow[]).map((row) => toView(row));
  if (!sessions.length) return sessions;

  const { data: marks } = await supabase
    .from("live_attendance_records")
    .select("live_session_id, status")
    .eq("student_id", studentId)
    .in(
      "live_session_id",
      sessions.map((s) => s.id),
    );

  const mine = new Map(
    ((marks ?? []) as Pick<LiveAttendanceRecord, "live_session_id" | "status">[]).map((m) => [
      m.live_session_id,
      m.status,
    ]),
  );

  return sessions.map((s) => ({ ...s, myAttendance: mine.get(s.id) ?? null }));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const sessionSchema = z
  .object({
    classId: z.string().uuid("Pick a class."),
    courseId: z.string().uuid().nullable().optional(),
    lessonId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(3, "Give the session a title.").max(120),
    description: z.string().trim().max(500).nullable().optional(),
    joinUrl: z.string().trim().min(1, "A session needs a join link."),
    // Full ISO with a zone, not "2026-10-05T09:00". A datetime-local input has
    // no offset in it, and this app's server runs in UTC while its users do not,
    // so the browser converts and the server never guesses.
    startsAt: z.string().datetime("Pick a start time."),
    endsAt: z.string().datetime().nullable().optional(),
    isVisibleToStudents: z.boolean().optional().default(false),
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, {
    message: "The session must end after it starts.",
    path: ["endsAt"],
  });

export const liveSessionSchema = sessionSchema;

export async function createLiveSession(input: unknown): Promise<string> {
  const editor = await requireContentEditor();
  const parsed = sessionSchema.parse(input);

  await assertTeacherCanAnnounce(editor.schoolId, parsed.classId, editor.teacherId);

  const supabase = await createSupabaseServerClient();
  if (!isAcceptableJoinUrl(parsed.joinUrl)) {
    throw new Error("The join link must be an http or https address.");
  }

  // RLS keys off the school_id on the row being inserted, so on its own it
  // would happily accept a class, course or lesson belonging to another school.
  // The referenced rows have to belong to this school too.
  await assertSchoolOwnsClass(supabase, editor.schoolId, parsed.classId);
  if (parsed.courseId) await assertSchoolOwnsCourse(supabase, editor.schoolId, parsed.courseId);
  if (parsed.lessonId) {
    await assertSchoolOwnsLesson(supabase, editor.schoolId, parsed.lessonId);
    if (parsed.courseId) {
      const courseId = await lessonCourseId(supabase, parsed.lessonId);
      if (courseId !== parsed.courseId) {
        throw new Error("That lesson belongs to a different course.");
      }
    }
  }

  const { data, error } = await supabase
    .from("live_sessions")
    .insert({
      school_id: editor.schoolId,
      class_id: parsed.classId,
      course_id: parsed.courseId ?? null,
      lesson_id: parsed.lessonId ?? null,
      title: parsed.title,
      description: parsed.description ?? null,
      join_url: parsed.joinUrl.trim(),
      starts_at: parsed.startsAt,
      ends_at: parsed.endsAt ?? null,
      is_visible_to_students: parsed.isVisibleToStudents,
      created_by: editor.userId,
    })
    .select("id")
    .single();

  if (error) throw new Error("We couldn't schedule this session.");
  return data.id;
}

export async function setLiveSessionVisibility(
  sessionId: string,
  isVisible: boolean,
): Promise<void> {
  const editor = await requireContentEditor();
  const supabase = await createSupabaseServerClient();

  const { data: session } = await supabase
    .from("live_sessions")
    .select("class_id")
    .eq("id", sessionId)
    .eq("school_id", editor.schoolId)
    .maybeSingle();

  if (!session) throw new Error("That session no longer exists.");
  await assertTeacherCanAnnounce(editor.schoolId, session.class_id, editor.teacherId);

  const { error } = await supabase
    .from("live_sessions")
    .update({ is_visible_to_students: isVisible })
    .eq("id", sessionId)
    .eq("school_id", editor.schoolId);
  if (error) throw new Error("We couldn't update this session.");
}

export async function setLiveSessionStatus(
  sessionId: string,
  status: LiveSessionStatus,
): Promise<void> {
  const editor = await requireContentEditor();
  const supabase = await createSupabaseServerClient();

  const { data: session } = await supabase
    .from("live_sessions")
    .select("class_id")
    .eq("id", sessionId)
    .eq("school_id", editor.schoolId)
    .maybeSingle();

  if (!session) throw new Error("That session no longer exists.");
  await assertTeacherCanAnnounce(editor.schoolId, session.class_id, editor.teacherId);

  const { error } = await supabase
    .from("live_sessions")
    .update({ status })
    .eq("id", sessionId)
    .eq("school_id", editor.schoolId);
  if (error) throw new Error("We couldn't update this session.");
}

export async function deleteLiveSession(sessionId: string): Promise<void> {
  const editor = await requireContentEditor();
  const supabase = await createSupabaseServerClient();

  const { data: session } = await supabase
    .from("live_sessions")
    .select("class_id")
    .eq("id", sessionId)
    .eq("school_id", editor.schoolId)
    .maybeSingle();

  if (!session) return;
  await assertTeacherCanAnnounce(editor.schoolId, session.class_id, editor.teacherId);

  const { error } = await supabase
    .from("live_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("school_id", editor.schoolId);
  if (error) throw new Error("We couldn't remove this session.");
}

const markSchema = z.object({
  liveSessionId: z.string().uuid(),
  entries: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(["present", "late", "absent", "excused"]).nullable(),
      }),
    )
    .min(1),
});

export const liveAttendanceSchema = markSchema;

/**
 * The register for one live session.
 *
 * Written with the service role because a teacher marking a class that contains
 * students from other schools' lineages still only touches their own session,
 * and RLS on live_attendance_records has to re-derive the class through
 * live_sessions on every row. The teacher/class check is made explicitly first,
 * and the ids are checked against the class roll before anything is written.
 */
export async function saveLiveAttendance(input: unknown): Promise<void> {
  const editor = await requireContentEditor();
  const parsed = markSchema.parse(input);

  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase
    .from("live_sessions")
    .select("class_id")
    .eq("id", parsed.liveSessionId)
    .eq("school_id", editor.schoolId)
    .maybeSingle();

  if (!session) throw new Error("That session no longer exists.");
  await assertTeacherCanAnnounce(editor.schoolId, session.class_id, editor.teacherId);

  const submitted = parsed.entries.filter((e) => e.status !== null);
  const cleared = parsed.entries.filter((e) => e.status === null).map((e) => e.studentId);

  const idsToTouch = [...submitted.map((e) => e.studentId), ...cleared];
  if (!idsToTouch.length) return;

  // Only ids that are actually on this roll may be marked or unmarked. Without
  // this a caller could pass the id of any student in the database and have a
  // mark written against this session.
  const { data: roll } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", editor.schoolId)
    .eq("class_id", session.class_id);
  const onRoll = new Set(((roll ?? []) as { id: string }[]).map((s) => s.id));
  if (idsToTouch.some((id) => !onRoll.has(id))) {
    throw new Error("Some students aren't in this class.");
  }

  const admin = createAdminClient();

  // Clearing a mark has to remove the row. Upserting a null would leave the old
  // status sitting there, which is the opposite of what the teacher just asked
  // for.
  if (cleared.length) {
    const { error: deleteError } = await admin
      .from("live_attendance_records")
      .delete()
      .eq("live_session_id", parsed.liveSessionId)
      .eq("school_id", editor.schoolId)
      .in("student_id", cleared);
    if (deleteError) throw new Error("We couldn't save the register.");
  }

  if (!submitted.length) return;

  const rows = submitted.map((entry) => ({
    school_id: editor.schoolId,
    live_session_id: parsed.liveSessionId,
    student_id: entry.studentId,
    status: entry.status,
    marked_by: editor.userId,
  }));

  const { error } = await admin
    .from("live_attendance_records")
    .upsert(rows, { onConflict: "live_session_id,student_id" });
  if (error) throw new Error("We couldn't save the register.");
}

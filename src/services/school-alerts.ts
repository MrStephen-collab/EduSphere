import { createAdminClient } from "@/lib/supabase/admin";
import { requireSchoolAdmin } from "@/services/shared";
import { asArray } from "@/lib/embed";
import {
  computeDecliningStudents,
  computeInactiveStudents,
  computeLowSubjects,
  UPCOMING_EXAM_DAYS,
  type DecliningStudent,
  type InactiveStudent,
  type LowSubject,
  type StudentActivity,
  type StudentHistory,
} from "@/lib/school-alerts";

// ---------------------------------------------------------------------------
// School dashboard alerts (spec section 34)
//
// The judgements (what counts as a decline, how long quiet is inactive, how
// many results make a subject "bad") live in src/lib/school-alerts.ts. This
// service only gathers the rows they need and hands them over. Every list is
// capped so a large school does not return an unbounded payload.
// ---------------------------------------------------------------------------

const RESULTS_LIMIT = 2000;
const ACTIVITY_LIMIT = 5000;
const PENDING_LIMIT = 2000;

export type PendingAssignment = {
  assignmentId: string;
  title: string;
  className: string | null;
  dueDate: string | null;
  /** Submissions handed in but not yet marked. */
  awaiting: number;
};

export type UpcomingExamination = {
  examinationId: string;
  title: string;
  className: string | null;
  startsAt: string;
};

export type SchoolAlerts = {
  decliningStudents: DecliningStudent[];
  pendingAssignments: PendingAssignment[];
  upcomingExaminations: UpcomingExamination[];
  inactiveStudents: InactiveStudent[];
  lowSubjects: LowSubject[];
};

export async function getSchoolAlerts(schoolId: string): Promise<SchoolAlerts> {
  const admin = createAdminClient();

  const now = new Date();
  const horizon = new Date(now.getTime() + UPCOMING_EXAM_DAYS * 86_400_000);

  const [
    resultsRes,
    studentsRes,
    classesRes,
    subjectsRes,
    progressRes,
    submissionsRes,
    attemptsRes,
    pendingRes,
    upcomingRes,
  ] = await Promise.all([
    admin
      .from("results")
      .select("student_id, percentage, subject_id, created_at")
      .eq("school_id", schoolId)
      .not("percentage", "is", null)
      .order("created_at", { ascending: false })
      .limit(RESULTS_LIMIT),
    admin
      .from("students")
      .select("id, display_name, class_id, created_at")
      .eq("school_id", schoolId),
    admin.from("classes").select("id, name").eq("school_id", schoolId),
    admin.from("subjects").select("id, name").eq("school_id", schoolId),
    admin
      .from("lesson_progress")
      .select("student_id, updated_at")
      .eq("school_id", schoolId)
      .order("updated_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
    admin
      .from("assignment_submissions")
      .select("student_id, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
    admin
      .from("practice_attempts")
      .select("student_id, started_at")
      .eq("school_id", schoolId)
      .order("started_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
    admin
      .from("assignment_submissions")
      .select("assignment_id, assignments(id, title, due_date, class_id, classes(name))")
      .eq("school_id", schoolId)
      .in("status", ["submitted", "late"])
      .limit(PENDING_LIMIT),
    admin
      .from("examinations")
      .select("id, title, starts_at, class_id, classes(name)")
      .eq("school_id", schoolId)
      .eq("status", "published")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", horizon.toISOString())
      .order("starts_at", { ascending: true }),
  ]);

  const classNames = new Map<string, string>(
    ((classesRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
  );
  const subjectNames = new Map<string, string>(
    ((subjectsRes.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );

  const students = (studentsRes.data ?? []) as {
    id: string;
    display_name: string | null;
    class_id: string | null;
    created_at: string;
  }[];
  const studentById = new Map(students.map((s) => [s.id, s]));

  // --- declining performance ------------------------------------------------
  const historyByStudent = new Map<string, number[]>();
  for (const r of (resultsRes.data ?? []) as {
    student_id: string;
    percentage: number;
  }[]) {
    const list = historyByStudent.get(r.student_id) ?? [];
    list.push(Number(r.percentage));
    historyByStudent.set(r.student_id, list);
  }
  const histories: StudentHistory[] = [...historyByStudent.entries()].map(
    ([studentId, percentages]) => {
      const student = studentById.get(studentId);
      return {
        studentId,
        displayName: student?.display_name ?? "Student",
        className: student?.class_id ? classNames.get(student.class_id) ?? null : null,
        percentages,
      };
    },
  );
  const decliningStudents = computeDecliningStudents(histories);

  // --- low-performing subjects ---------------------------------------------
  const subjectBuckets = new Map<string, { total: number; count: number }>();
  for (const r of (resultsRes.data ?? []) as {
    subject_id: string | null;
    percentage: number;
  }[]) {
    if (!r.subject_id) continue;
    const bucket = subjectBuckets.get(r.subject_id) ?? { total: 0, count: 0 };
    bucket.total += Number(r.percentage);
    bucket.count += 1;
    subjectBuckets.set(r.subject_id, bucket);
  }
  const lowSubjects = computeLowSubjects(
    [...subjectBuckets.entries()].map(([subjectId, b]) => ({
      subjectId,
      subjectName: subjectNames.get(subjectId) ?? "Subject",
      average: Math.round(b.total / b.count),
      results: b.count,
    })),
  );

  // --- inactivity -----------------------------------------------------------
  const lastSeen = new Map<string, string>();
  const remember = (studentId: string | null, at: string | null) => {
    if (!studentId || !at) return;
    const current = lastSeen.get(studentId);
    if (!current || at > current) lastSeen.set(studentId, at);
  };
  for (const p of (progressRes.data ?? []) as { student_id: string; updated_at: string }[]) {
    remember(p.student_id, p.updated_at);
  }
  for (const s of (submissionsRes.data ?? []) as { student_id: string; created_at: string }[]) {
    remember(s.student_id, s.created_at);
  }
  for (const a of (attemptsRes.data ?? []) as { student_id: string; started_at: string }[]) {
    remember(a.student_id, a.started_at);
  }

  const activity: StudentActivity[] = students.map((s) => ({
    studentId: s.id,
    displayName: s.display_name ?? "Student",
    className: s.class_id ? classNames.get(s.class_id) ?? null : null,
    createdAt: s.created_at,
    lastActiveAt: lastSeen.get(s.id) ?? null,
  }));
  const inactiveStudents = computeInactiveStudents(activity, now);

  // --- pending assignments --------------------------------------------------
  const pendingBuckets = new Map<
    string,
    { title: string; className: string | null; dueDate: string | null; awaiting: number }
  >();
  for (const row of (pendingRes.data ?? []) as {
    assignment_id: string;
    assignments:
      | { id: string; title: string; due_date: string | null; class_id: string | null; classes: { name: string }[] | { name: string } | null }
      | Array<{
          id: string;
          title: string;
          due_date: string | null;
          class_id: string | null;
          classes: { name: string }[] | { name: string } | null;
        }>
      | null;
  }[]) {
    const assignment = asArray(row.assignments)[0];
    if (!assignment) continue;
    const bucket = pendingBuckets.get(row.assignment_id) ?? {
      title: assignment.title,
      className: assignment.class_id
        ? classNames.get(assignment.class_id) ?? asArray(assignment.classes)[0]?.name ?? null
        : asArray(assignment.classes)[0]?.name ?? null,
      dueDate: assignment.due_date,
      awaiting: 0,
    };
    bucket.awaiting += 1;
    pendingBuckets.set(row.assignment_id, bucket);
  }
  const pendingAssignments: PendingAssignment[] = [...pendingBuckets.entries()]
    .map(([assignmentId, b]) => ({
      assignmentId,
      title: b.title,
      className: b.className,
      dueDate: b.dueDate,
      awaiting: b.awaiting,
    }))
    .sort((a, b) => {
      // Overdue first (oldest due date), then undated, then more waiting.
      if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return b.awaiting - a.awaiting;
    });

  // --- upcoming examinations ------------------------------------------------
  const upcomingExaminations: UpcomingExamination[] = ((upcomingRes.data ?? []) as Array<{
    id: string;
    title: string;
    starts_at: string | null;
    class_id: string | null;
    classes: { name: string }[] | { name: string } | null;
  }>)
    .filter((e) => e.starts_at)
    .map((e) => ({
      examinationId: e.id,
      title: e.title,
      className: e.class_id
        ? classNames.get(e.class_id) ?? asArray(e.classes)[0]?.name ?? null
        : asArray(e.classes)[0]?.name ?? null,
      startsAt: e.starts_at as string,
    }));

  return {
    decliningStudents,
    pendingAssignments,
    upcomingExaminations,
    inactiveStudents,
    lowSubjects,
  };
}

/** Require a school admin and return alerts for their own school. */
export async function getSchoolAlertsForCurrentAdmin(): Promise<SchoolAlerts> {
  const { schoolId } = await requireSchoolAdmin();
  return getSchoolAlerts(schoolId);
}

import type {
  AcademicSession,
  PracticeAttempt,
  School,
  Student,
  Term,
} from "@/types/database";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { rowExists } from "@/lib/supabase/queries";
import { asArray } from "@/lib/embed";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function pct(score: number | null, total: number | null | undefined): number | null {
  if (score == null || !total) return null;
  return Math.round((score / total) * 100);
}

function average(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
}

function best(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

type GradeBand = {
  name: string;
  min_percentage: number;
  max_percentage: number;
  remark: string | null;
};

function gradeFor(percentage: number | null, bands: GradeBand[]): GradeBand | null {
  if (percentage == null) return null;
  const sorted = [...bands].sort((a, b) => b.max_percentage - a.max_percentage);
  return (
    sorted.find(
      (g) => percentage >= g.min_percentage && percentage <= g.max_percentage,
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Scoped data fetches (all reads flow through the user-scoped server client,
// so RLS keeps each caller to the data they are allowed to see).
// ---------------------------------------------------------------------------

type Scope =
  | { kind: "term"; term: Term }
  | { kind: "session"; session: AcademicSession };

function boundsOf(scope: Scope): { startsAt: string | null; endsAt: string | null } {
  if (scope.kind === "term") {
    return {
      startsAt:
        scope.term.starts_at != null
          ? new Date(`${scope.term.starts_at}T00:00:00`).toISOString()
          : null,
      endsAt:
        scope.term.ends_at != null
          ? new Date(`${scope.term.ends_at}T23:59:59`).toISOString()
          : null,
    };
  }
  return {
    startsAt:
      scope.session.start_date != null
        ? new Date(`${scope.session.start_date}T00:00:00`).toISOString()
        : null,
    endsAt:
      scope.session.end_date != null
        ? new Date(`${scope.session.end_date}T23:59:59`).toISOString()
        : null,
  };
}

// Attendance records store a plain date (YYYY-MM-DD), so the scope bounds are
// used directly rather than the ISO timestamps derived for graded timestamps.
function attendanceDateBounds(scope: Scope): { start: string | null; end: string | null } {
  if (scope.kind === "term") {
    return { start: scope.term.starts_at, end: scope.term.ends_at };
  }
  return { start: scope.session.start_date, end: scope.session.end_date };
}

function inRange(
  value: string | null | undefined,
  bounds: { startsAt: string | null; endsAt: string | null },
): boolean {
  if (!value) return false;
  if (bounds.startsAt && value < bounds.startsAt) return false;
  if (bounds.endsAt && value > bounds.endsAt) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

type AssignmentRow = {
  student_id: string;
  score: number | null;
  graded_at: string | null;
  assignments: {
    subject_id: string | null;
    max_score: number | null;
    subjects: { name: string } | { name: string }[] | null;
  } | { subject_id: string | null; max_score: number | null; subjects: { name: string } | { name: string }[] | null }[] | null;
};

type AttemptRow = PracticeAttempt & {
  exam_series: {
    subject_id: string | null;
    subjects: { name: string } | { name: string }[] | null;
  } | { subject_id: string | null; subjects: { name: string } | { name: string }[] | null }[] | null;
};

type SubjectAgg = {
  subjectId: string | null;
  name: string;
  assignmentPcts: (number | null)[];
  practicePcts: (number | null)[];
};

function groupRows(
  assignments: AssignmentRow[],
  attempts: AttemptRow[],
): Map<string, Map<string, SubjectAgg>> {
  const byStudent = new Map<string, Map<string, SubjectAgg>>();

  const touch = (studentId: string, subjectId: string | null, name: string) => {
    const key = subjectId ?? "__general__";
    let subjects = byStudent.get(studentId);
    if (!subjects) {
      subjects = new Map();
      byStudent.set(studentId, subjects);
    }
    if (!subjects.has(key)) {
      subjects.set(key, { subjectId, name, assignmentPcts: [], practicePcts: [] });
    }
    return subjects.get(key)!;
  };

  for (const a of assignments) {
    const assignment = asArray(a.assignments)[0];
    if (!assignment) continue;
    const agg = touch(
      a.student_id,
      assignment.subject_id,
      asArray(assignment.subjects)[0]?.name ?? "General",
    );
    agg.assignmentPcts.push(pct(a.score, assignment.max_score));
  }

  for (const t of attempts) {
    const series = asArray(t.exam_series)[0];
    if (!series) continue;
    const agg = touch(
      t.student_id,
      series.subject_id,
      asArray(series.subjects)[0]?.name ?? "General",
    );
    agg.practicePcts.push(pct(t.score, t.total_marks));
  }

  return byStudent;
}

export type ReportSubject = {
  subjectId: string | null;
  name: string;
  assignmentAverage: number | null;
  practiceBest: number | null;
  total: number | null;
  grade: string | null;
  remark: string | null;
  teacherName: string | null;
};

export type ComputedRow = {
  studentId: string;
  subjects: ReportSubject[];
  overall: number | null;
  grade: string | null;
  remark: string | null;
};

function computeRow(
  studentId: string,
  agg: Map<string, SubjectAgg> | undefined,
  bands: GradeBand[],
  teacherBySubject: Map<string, string | null>,
): ComputedRow {
  const subjectRows: ReportSubject[] = [...(agg?.values() ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => {
      const assignmentAverage = average(s.assignmentPcts);
      const practiceBest = best(s.practicePcts);
      const total = average([assignmentAverage, practiceBest]);
      const band = gradeFor(total, bands);
      const subjectId = s.subjectId ?? undefined;
      return {
        subjectId: s.subjectId,
        name: s.name,
        assignmentAverage,
        practiceBest,
        total,
        grade: band?.name ?? null,
        remark: band?.remark ?? null,
        teacherName: subjectId ? teacherBySubject.get(subjectId) ?? null : null,
      };
    })
    .filter((s) => s.total != null);

  const overall = average(subjectRows.map((s) => s.total));
  const band = gradeFor(overall, bands);

  return {
    studentId,
    subjects: subjectRows,
    overall,
    grade: band?.name ?? null,
    remark: band?.remark ?? null,
  };
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ReportOptions = {
  school: Pick<
    School,
    "name" | "motto" | "logo_url" | "address" | "city" | "state"
  >;
  sessions: (AcademicSession & { terms: Term[] })[];
  classes: { id: string; name: string }[];
};

export type StudentMeta = {
  id: string;
  displayName: string | null;
  admissionNumber: string;
  className: string | null;
  streamName: string | null;
  gender: string | null;
};

export type ReportAttendance = {
  present: number;
  late: number;
  absent: number;
  excused: number;
  recorded: number;
  classDays: number;
  rate: number | null;
};

export const EMPTY_ATTENDANCE: ReportAttendance = {
  present: 0,
  late: 0,
  absent: 0,
  excused: 0,
  recorded: 0,
  classDays: 0,
  rate: null,
};

export type StudentReportCard = {
  school: ReportOptions["school"];
  student: StudentMeta;
  scopeName: string;
  scopeKind: "term" | "session";
  scopePeriod: string | null;
  subjects: ReportSubject[];
  overall: number | null;
  grade: string | null;
  remark: string | null;
  position: number | null;
  totalStudents: number;
  attendance: ReportAttendance | null;
  generatedAt: string;
};

export type ClassReportRow = ComputedRow & {
  displayName: string | null;
  admissionNumber: string;
  position: number;
  attendance: ReportAttendance;
};

export type ClassReport = {
  school: ReportOptions["school"];
  className: string | null;
  scopeName: string;
  scopeKind: "term" | "session";
  scopePeriod: string | null;
  subjectColumns: string[];
  students: ClassReportRow[];
  generatedAt: string;
};

// ---------------------------------------------------------------------------
// Report options
// ---------------------------------------------------------------------------

export async function getReportOptions(
  schoolId: string,
  teacherId: string | null = null,
): Promise<ReportOptions> {
  const supabase = await createSupabaseServerClient();

  const [{ data: school }, { data: sessionsRes }, { data: classes }] =
    await Promise.all([
      supabase
        .from("schools")
        .select("name, motto, logo_url, address, city, state")
        .eq("id", schoolId)
        .maybeSingle(),
      supabase
        .from("academic_sessions")
        .select("*, terms(*)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),
      supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("order", { ascending: true }),
    ]);

  let classRows = (classes ?? []) as { id: string; name: string }[];
  if (teacherId) {
    const { data: links } = await supabase
      .from("teacher_classes")
      .select("class_id")
      .eq("school_id", schoolId)
      .eq("teacher_id", teacherId);
    const linked = new Set((links ?? []).map((l) => l.class_id));
    classRows = classRows.filter((c) => linked.has(c.id));
  }

  return {
    school: (school ?? {
      name: "School",
      motto: null,
      logo_url: null,
      address: null,
      city: null,
      state: null,
    }) as ReportOptions["school"],
    sessions: (sessionsRes ?? []) as (AcademicSession & { terms: Term[] })[],
    classes: classRows,
  };
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

async function loadBands(schoolId: string): Promise<GradeBand[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("grades")
    .select("name, min_percentage, max_percentage, remark")
    .eq("school_id", schoolId);
  return (data ?? []) as GradeBand[];
}

async function loadStudents(
  schoolId: string,
  classId: string,
): Promise<(Student & { streams: { name: string } | { name: string }[] | null })[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("students")
    .select("*, streams(name)")
    .eq("school_id", schoolId)
    .eq("class_id", classId);
  return (data ?? []) as (Student & { streams: { name: string } | { name: string }[] | null })[];
}

async function loadSubjectTeachers(
  schoolId: string,
  sessionId: string,
): Promise<Map<string, string | null>> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("teacher_subjects")
    .select("subject_id, teachers(display_name)")
    .eq("school_id", schoolId)
    .eq("session_id", sessionId);
  const map = new Map<string, string | null>();
  for (const row of data ?? []) {
    if (!row.subject_id || map.has(row.subject_id)) continue;
    const teachers = (row as { teachers?: { display_name: string | null } | { display_name: string | null }[] })
      .teachers;
    map.set(row.subject_id, asArray(teachers)[0]?.display_name ?? null);
  }
  return map;
}

type ScopeMeta = {
  name: string;
  kind: "term" | "session";
  period: string | null;
};

function scopeMeta(scope: Scope): ScopeMeta {
  if (scope.kind === "term") {
    return {
      name: scope.term.name,
      kind: "term",
      period: scope.term.starts_at && scope.term.ends_at
        ? `${scope.term.starts_at} – ${scope.term.ends_at}`
        : null,
    };
  }
  return {
    name: scope.session.name,
    kind: "session",
    period:
      scope.session.start_date && scope.session.end_date
        ? `${scope.session.start_date} – ${scope.session.end_date}`
        : null,
  };
}

function rowsFor(scope: Scope): { startsAt: string | null; endsAt: string | null } {
  return boundsOf(scope);
}

// ---------------------------------------------------------------------------
// Public accessors
// ---------------------------------------------------------------------------

export async function getClassReport(
  schoolId: string,
  classId: string,
  scope: Scope,
  opts: { teacherId?: string | null } = {},
): Promise<ClassReport | null> {
  const supabase = await createSupabaseServerClient();

  if (opts.teacherId) {
    const linked = await rowExists(supabase, "teacher_classes", {
      school_id: schoolId,
      teacher_id: opts.teacherId,
      class_id: classId,
    });
    if (!linked) return null;
  }

  const [school, cls, students, bands, options] = await Promise.all([
    supabase
      .from("schools")
      .select("name, motto, logo_url, address, city, state")
      .eq("id", schoolId)
      .maybeSingle()
      .then((r) => r.data),
    supabase
      .from("classes")
      .select("name")
      .eq("id", classId)
      .eq("school_id", schoolId)
      .maybeSingle()
      .then((r) => r.data),
    loadStudents(schoolId, classId),
    loadBands(schoolId),
    getReportOptions(schoolId, opts.teacherId ?? null),
  ]);

  if (!cls) return null;

  const studentIds = (students ?? []).map((s) => s.id);
  const [assignmentData, attemptData, attendance, teachers] = await Promise.all([
    fetchAssignments(schoolId, studentIds, scope),
    fetchAttempts(schoolId, studentIds, scope),
    fetchAttendance(schoolId, classId, studentIds, scope),
    scope.kind === "term"
      ? loadSubjectTeachers(schoolId, scope.term.session_id)
      : Promise.resolve(new Map<string, string | null>()),
  ]);

  const grouped = groupRows(assignmentData, attemptData);
  const teacherBySubject = teachers;

  const rows = (students ?? [])
    .map((s) => {
      const computed = computeRow(s.id, grouped.get(s.id), bands, teacherBySubject);
      return {
        ...computed,
        displayName: s.display_name ?? "Student",
        admissionNumber: s.admission_number,
        attendance: attendance.get(s.id) ?? EMPTY_ATTENDANCE,
      };
    })
    .sort((a, b) =>
      b.overall == null
        ? 1
        : a.overall == null
          ? -1
          : b.overall - a.overall || a.displayName!.localeCompare(b.displayName!),
    )
    .map((r, i) => ({ ...r, position: r.overall == null ? 0 : i + 1 }));

  const subjectColumns = [...new Set(rows.flatMap((r) => r.subjects.map((s) => s.name)))].sort(
    (a, b) => a.localeCompare(b),
  );

  const meta = scopeMeta(scope);
  return {
    school: (school ?? options.school) as ClassReport["school"],
    className: cls.name,
    scopeName: meta.name,
    scopeKind: meta.kind,
    scopePeriod: meta.period,
    subjectColumns,
    students: rows as ClassReportRow[],
    generatedAt: new Date().toISOString(),
  };
}

export async function getStudentReport(
  schoolId: string,
  studentId: string,
  scope: Scope,
  opts: { teacherId?: string | null } = {},
): Promise<StudentReportCard | null> {
  const supabase = await createSupabaseServerClient();

  const [school, student, options] = await Promise.all([
    supabase
      .from("schools")
      .select("name, motto, logo_url, address, city, state")
      .eq("id", schoolId)
      .maybeSingle()
      .then((r) => r.data),
    supabase
      .from("students")
      .select("*, streams(name)")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle()
      .then((r) => r.data),
    getReportOptions(schoolId, opts.teacherId ?? null),
  ]);

  if (!student) return null;

  const classId = student.class_id;
  if (!classId) {
    return {
      school: (school ?? options.school) as StudentReportCard["school"],
      student: toStudentMeta(student),
      scopeName: scopeMeta(scope).name,
      scopeKind: scopeMeta(scope).kind,
      scopePeriod: scopeMeta(scope).period,
      subjects: [],
      overall: null,
      grade: null,
      remark: null,
      position: null,
      totalStudents: 0,
      attendance: null,
      generatedAt: new Date().toISOString(),
    };
  }

  const classReport = await getClassReport(schoolId, classId, scope, opts);
  if (!classReport) return null;

  const row = classReport.students.find((s) => s.studentId === studentId) ?? null;
  const position = row?.position ?? null;

  return {
    school: classReport.school,
    student: {
      ...toStudentMeta(student),
      className: classReport.className,
    },
    scopeName: classReport.scopeName,
    scopeKind: classReport.scopeKind,
    scopePeriod: classReport.scopePeriod,
    subjects: row?.subjects ?? [],
    overall: row?.overall ?? null,
    grade: row?.grade ?? null,
    remark: row?.remark ?? null,
    position,
    totalStudents: classReport.students.length,
    attendance: row?.attendance ?? null,
    generatedAt: classReport.generatedAt,
  };
}

function toStudentMeta(
  student: Student & { streams: { name: string } | { name: string }[] | null },
): StudentMeta {
  return {
    id: student.id,
    displayName: student.display_name ?? "Student",
    admissionNumber: student.admission_number,
    className: null,
    streamName: asArray(student.streams)[0]?.name ?? null,
    gender: student.gender,
  };
}

async function fetchAssignments(
  schoolId: string,
  studentIds: string[],
  scope: Scope,
): Promise<AssignmentRow[]> {
  if (studentIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("assignment_submissions")
    .select("student_id, score, graded_at, assignments(subject_id, max_score, subjects(name))")
    .eq("school_id", schoolId)
    .eq("status", "graded")
    .not("score", "is", null)
    .in("student_id", studentIds);
  const bounds = rowsFor(scope);
  return ((data ?? []) as unknown as AssignmentRow[]).filter((r) =>
    inRange(r.graded_at, bounds),
  );
}

async function fetchAttempts(
  schoolId: string,
  studentIds: string[],
  scope: Scope,
): Promise<AttemptRow[]> {
  if (studentIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("practice_attempts")
    .select("*, exam_series(subject_id, subjects(name))")
    .eq("school_id", schoolId)
    .in("status", ["submitted", "timed_out"])
    .not("submitted_at", "is", null)
    .in("student_id", studentIds);
  const bounds = rowsFor(scope);
  return ((data ?? []) as AttemptRow[]).filter((r) =>
    inRange(r.submitted_at, bounds),
  );
}

type AttendanceRow = {
  student_id: string;
  date: string;
  status: "present" | "late" | "absent" | "excused";
};

async function fetchAttendance(
  schoolId: string,
  classId: string,
  studentIds: string[],
  scope: Scope,
): Promise<Map<string, ReportAttendance>> {
  if (studentIds.length === 0) return new Map();
  const bounds = attendanceDateBounds(scope);

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("attendance_records")
    .select("student_id, date, status")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .in("student_id", studentIds);
  if (bounds.start) query = query.gte("date", bounds.start);
  if (bounds.end) query = query.lte("date", bounds.end);
  const { data } = await query;

  const rows = (data ?? []) as AttendanceRow[];
  const classDays = new Set(rows.map((r) => r.date)).size;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  const byStudent = new Map<string, ReportAttendance>();
  for (const id of studentIds) byStudent.set(id, { ...EMPTY_ATTENDANCE });

  const counts = new Map<string, { late: number; absent: number; excused: number; presentOnly: number }>();
  for (const s of sorted) {
    const acc = counts.get(s.student_id) ?? { late: 0, absent: 0, excused: 0, presentOnly: 0 };
    if (s.status === "late") acc.late += 1;
    else if (s.status === "absent") acc.absent += 1;
    else if (s.status === "excused") acc.excused += 1;
    else acc.presentOnly += 1;
    counts.set(s.student_id, acc);
  }

  for (const id of studentIds) {
    const acc = counts.get(id);
    if (!acc) continue;
    const present = acc.presentOnly + acc.late;
    const recorded = acc.presentOnly + acc.late + acc.absent + acc.excused;
    byStudent.set(id, {
      present,
      late: acc.late,
      absent: acc.absent,
      excused: acc.excused,
      recorded,
      classDays,
      rate: classDays > 0 ? Math.round((present / classDays) * 100) : null,
    });
  }

  return byStudent;
}
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentCourses } from "@/services/learning";
import type { PracticeAttempt } from "@/types/database";
import { asArray } from "@/lib/embed";

function pct(score: number | null, total: number | null | undefined): number | null {
  if (score == null || !total) return null;
  return Math.round((score / total) * 100);
}

function average(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
}

async function lookupGrade(
  schoolId: string,
  percentage: number | null,
): Promise<string | null> {
  if (percentage == null) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("grade_for_percentage", {
    p_school_id: schoolId,
    p_percentage: percentage,
  });
  return (data as string | null) ?? null;
}

// ---------------------------------------------------------------------------
// Student results
// ---------------------------------------------------------------------------

export type StudentPracticeItem = {
  seriesId: string;
  title: string;
  examType: string;
  subject: string | null;
  attempts: number;
  best: number | null;
};

export type StudentGradedAssignment = {
  id: string;
  title: string;
  subject: string | null;
  score: number | null;
  maxScore: number;
  percentage: number | null;
  gradedAt: string | null;
};

export type StudentResultRow = {
  id: string;
  subject: string | null;
  score: number | null;
  percentage: number | null;
  publishedAt: string | null;
};

export type StudentResults = {
  practiceAttempts: number;
  seriesPracticed: number;
  practiceAverage: number | null;
  practiceBest: number | null;
  perSeries: StudentPracticeItem[];
  gradedAssignments: StudentGradedAssignment[];
  results: StudentResultRow[];
  courseAverage: number | null;
  subjectPerformance: { subject: string; practiceAverage: number | null; assignmentAverage: number | null }[];
  overallAverage: number | null;
  grade: string | null;
};

export async function getStudentResults(
  schoolId: string,
  studentId: string,
): Promise<StudentResults> {
  const supabase = await createSupabaseServerClient();

  const { data: attempts } = await supabase
    .from("practice_attempts")
    .select("*, exam_series(title, exam_type, class_id, subjects(name))")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(100);

  const attemptRows = (attempts ?? []) as (PracticeAttempt & {
    exam_series: {
      title: string;
      exam_type: string;
      subjects: { name: string } | { name: string }[] | null;
    } | { title: string; exam_type: string; subjects: { name: string } | { name: string }[] | null }[] | null;
  })[];

  const practicePcts = attemptRows.map((a) => pct(a.score, a.total_marks));
  const perSeriesMap = new Map<string, StudentPracticeItem>();
  for (const a of attemptRows) {
    const series = asArray(a.exam_series)[0];
    const existing = perSeriesMap.get(a.exam_series_id) ?? {
      seriesId: a.exam_series_id,
      title: series?.title ?? "Unknown series",
      examType: series?.exam_type ?? "school",
      subject: asArray(series?.subjects)[0]?.name ?? null,
      attempts: 0,
      best: null as number | null,
    };
    existing.attempts += 1;
    const p = pct(a.score, a.total_marks);
    if (p != null && (existing.best === null || p > existing.best)) existing.best = p;
    perSeriesMap.set(a.exam_series_id, existing);
  }

  const bySubject = new Map<string, { practice: number[]; assignment: number[] }>();
  for (const a of attemptRows) {
    const subject = asArray(asArray(a.exam_series)[0]?.subjects)[0]?.name ?? "General";
    const p = pct(a.score, a.total_marks);
    if (p != null) {
      const entry = bySubject.get(subject) ?? { practice: [], assignment: [] };
      entry.practice.push(p);
      bySubject.set(subject, entry);
    }
  }

  const { data: submissions } = await supabase
    .from("assignment_submissions")
    .select("*, assignments(title, subject_id, subjects(name))")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("status", "graded")
    .not("score", "is", null)
    .order("graded_at", { ascending: false });

  const subRows = (submissions ?? []) as {
    assignment_id: string;
    score: number | null;
    graded_at: string | null;
    assignments:
      | { title: string; subject_id: string | null; subjects: { name: string } | { name: string }[] | null }
      | { title: string; subject_id: string | null; subjects: { name: string } | { name: string }[] | null }[]
      | null;
  }[];

  const gradedAssignments: StudentGradedAssignment[] = [];
  const maxScoreById = new Map<string, number>();
  for (const s of subRows) {
    const assignment = asArray(s.assignments)[0];
    if (!assignment) continue;
    maxScoreById.set(s.assignment_id, 0);
    gradedAssignments.push({
      id: s.assignment_id,
      title: assignment.title,
      subject: asArray(assignment.subjects)[0]?.name ?? null,
      score: s.score,
      maxScore: 0,
      percentage: null,
      gradedAt: s.graded_at,
    });
  }

  if (maxScoreById.size > 0) {
    const { data: assignmentRows } = await supabase
      .from("assignments")
      .select("id, max_score")
      .eq("school_id", schoolId)
      .in("id", [...maxScoreById.keys()]);
    for (const r of assignmentRows ?? []) maxScoreById.set(r.id, r.max_score);
  }

  for (const item of gradedAssignments) {
    item.maxScore = maxScoreById.get(item.id) ?? 0;
    item.percentage = pct(item.score, item.maxScore);
    const subject = item.subject ?? "General";
    const entry = bySubject.get(subject) ?? { practice: [], assignment: [] };
    if (item.percentage != null) entry.assignment.push(item.percentage);
    bySubject.set(subject, entry);
  }

  const { data: resultRows } = await supabase
    .from("results")
    .select("*, subjects(name)")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  const results: StudentResultRow[] = (resultRows ?? []).map((r) => ({
    id: r.id,
    subject:
      asArray((r as { subjects?: { name: string } | { name: string }[] | null }).subjects)[0]?.name ??
      null,
    score: r.score,
    percentage: r.percentage,
    publishedAt: r.published_at,
  }));

  const courses = await getStudentCourses(schoolId, studentId);
  const courseAverage = average(courses.map((c) => c.overallPercentage));

  const subjectPerformance = [...bySubject.entries()].map(([subject, e]) => ({
    subject,
    practiceAverage: average(e.practice),
    assignmentAverage: average(e.assignment),
  }));

  const overallAverage = average([
    courseAverage,
    average(practicePcts),
    ...(gradedAssignments.length ? [average(gradedAssignments.map((g) => g.percentage))] : []),
    ...(results.length ? [average(results.map((r) => r.percentage))] : []),
  ]);

  return {
    practiceAttempts: attemptRows.length,
    seriesPracticed: perSeriesMap.size,
    practiceAverage: average(practicePcts),
    practiceBest: average([...perSeriesMap.values()].map((s) => s.best)),
    perSeries: [...perSeriesMap.values()],
    gradedAssignments,
    results,
    courseAverage,
    subjectPerformance: subjectPerformance.filter((s) => s.practiceAverage != null || s.assignmentAverage != null),
    overallAverage,
    grade: await lookupGrade(schoolId, overallAverage),
  };
}

// ---------------------------------------------------------------------------
// Teacher analytics
// ---------------------------------------------------------------------------

export type TeacherClassStat = {
  classId: string;
  className: string;
  students: number;
  assignments: number;
  graded: number;
  pending: number;
  practiceAttempts: number;
  practiceAverage: number | null;
};

export type TeacherRecentAttempt = {
  attemptId: string;
  seriesTitle: string;
  studentName: string | null;
  score: number | null;
  total: number | null;
  percentage: number | null;
  submittedAt: string | null;
};

export type TeacherAnalytics = {
  classes: { id: string; name: string }[];
  classStats: TeacherClassStat[];
  students: number;
  publishedAssignments: number;
  toGrade: number;
  practiceAttempts: number;
  practiceAverage: number | null;
  recentAttempts: TeacherRecentAttempt[];
  workload: {
    id: string;
    title: string;
    className: string | null;
    published: boolean;
    submissions: number;
    graded: number;
    pending: number;
  }[];
};

export async function getTeacherAnalytics(
  schoolId: string,
  userId: string,
  role: string,
  teacherId: string | null,
): Promise<TeacherAnalytics> {
  const admin = createAdminClient();
  const ownOnly = role === "TEACHER";

  const { data: allClasses } = await admin
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("order", { ascending: true });

  let classIds: string[] = (allClasses ?? []).map((c) => c.id);
  if (ownOnly && teacherId) {
    const { data: links } = await admin
      .from("teacher_classes")
      .select("class_id")
      .eq("school_id", schoolId)
      .eq("teacher_id", teacherId);
    const linked = (links ?? []).map((l) => l.class_id);
    if (linked.length) classIds = linked;
  }

  const classes = (allClasses ?? [])
    .filter((c) => classIds.includes(c.id))
    .map((c) => ({ id: c.id, name: c.name }));

  let assignments: { id: string; title: string; class_id: string | null; status: string }[] = [];
  if (classIds.length) {
    let query = admin
      .from("assignments")
      .select("id, title, class_id, status")
      .eq("school_id", schoolId)
      .is("deleted_at", null);
    if (ownOnly) query = query.eq("created_by", userId);
    const { data } = await query;
    assignments = (data ?? []) as typeof assignments;
  }

  const assignmentIds = assignments.map((a) => a.id);
  let subs: { assignment_id: string; status: string }[] = [];
  if (assignmentIds.length) {
    const { data } = await admin
      .from("assignment_submissions")
      .select("assignment_id, status")
      .eq("school_id", schoolId)
      .in("assignment_id", assignmentIds);
    subs = (data ?? []) as typeof subs;
  }

  const subByAssignment = new Map<string, { submissions: number; graded: number }>();
  for (const s of subs) {
    const e = subByAssignment.get(s.assignment_id) ?? { submissions: 0, graded: 0 };
    e.submissions += 1;
    if (s.status === "graded") e.graded += 1;
    subByAssignment.set(s.assignment_id, e);
  }

  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const workload: TeacherAnalytics["workload"] = assignments.map((a) => {
    const c = subByAssignment.get(a.id) ?? { submissions: 0, graded: 0 };
    return {
      id: a.id,
      title: a.title,
      className: a.class_id ? classMap.get(a.class_id) ?? null : null,
      published: a.status === "published",
      submissions: c.submissions,
      graded: c.graded,
      pending: c.submissions - c.graded,
    };
  });

  let series: { id: string; title: string; class_id: string | null }[] = [];
  if (classIds.length) {
    let query = admin
      .from("exam_series")
      .select("id, title, class_id")
      .eq("school_id", schoolId)
      .is("deleted_at", null);
    if (ownOnly) query = query.eq("created_by", userId);
    const { data } = await query;
    series = (data ?? []) as typeof series;
  }

  const seriesIds = series.map((s) => s.id);
  let attempts: (PracticeAttempt & {
    exam_series:
      | { title: string; class_id: string | null }
      | { title: string; class_id: string | null }[]
      | null;
    students: { display_name: string | null } | { display_name: string | null }[] | null;
  })[] = [];
  if (seriesIds.length) {
    const { data } = await admin
      .from("practice_attempts")
      .select("*, exam_series(title, class_id), students(display_name)")
      .eq("school_id", schoolId)
      .in("exam_series_id", seriesIds)
      .order("created_at", { ascending: false })
      .limit(500);
    attempts = (data ?? []) as typeof attempts;
  }

  const attemptPcts = attempts.map((a) => pct(a.score, a.total_marks));
  const classAttempts = new Map<string, { count: number; pcts: (number | null)[] }>();
  for (const a of attempts) {
    const key = asArray(a.exam_series)[0]?.class_id ?? "none";
    const entry = classAttempts.get(key) ?? { count: 0, pcts: [] as (number | null)[] };
    entry.count += 1;
    entry.pcts.push(pct(a.score, a.total_marks));
    classAttempts.set(key, entry);
  }

  const { data: studentClassRows } = await admin
    .from("students")
    .select("class_id")
    .eq("school_id", schoolId);
  const studentCountByClass = new Map<string, number>();
  for (const s of studentClassRows ?? []) {
    if (!s.class_id) continue;
    studentCountByClass.set(s.class_id, (studentCountByClass.get(s.class_id) ?? 0) + 1);
  }

  const classStats: TeacherClassStat[] = classes.map((c) => {
    const aList = workload.filter((w) => w.className === c.name);
    const attempt = classAttempts.get(c.id);
    return {
      classId: c.id,
      className: c.name,
      students: studentCountByClass.get(c.id) ?? 0,
      assignments: aList.filter((w) => w.published).length,
      graded: aList.reduce((sum, w) => sum + w.graded, 0),
      pending: aList.reduce((sum, w) => sum + w.pending, 0),
      practiceAttempts: attempt?.count ?? 0,
      practiceAverage: average(attempt?.pcts ?? []),
    };
  });

  const recentAttempts: TeacherRecentAttempt[] = attempts.slice(0, 8).map((a) => ({
    attemptId: a.id,
    seriesTitle: asArray(a.exam_series)[0]?.title ?? "Unknown series",
    studentName: asArray(a.students)[0]?.display_name ?? "Student",
    score: a.score,
    total: a.total_marks,
    percentage: pct(a.score, a.total_marks),
    submittedAt: a.submitted_at,
  }));

  const gradedCount = subs.filter((s) => s.status === "graded").length;

  return {
    classes,
    classStats,
    students: [...studentCountByClass.values()].reduce((s, n) => s + n, 0),
    publishedAssignments: workload.filter((w) => w.published).length,
    toGrade: subs.length - gradedCount,
    practiceAttempts: attempts.length,
    practiceAverage: average(attemptPcts),
    recentAttempts,
    workload,
  };
}

// ---------------------------------------------------------------------------
// School analytics (admin dashboard)
// ---------------------------------------------------------------------------

export type SchoolSubjectAvg = {
  subjectId: string;
  subjectName: string;
  average: number;
  results: number;
};

export type SchoolClassAvg = {
  classId: string | null;
  className: string;
  average: number;
  results: number;
};

export type SchoolTopicStat = {
  topic: string;
  average: number;
  answers: number;
};

export type SchoolTopStudent = {
  studentId: string;
  displayName: string;
  className: string | null;
  average: number;
  results: number;
};

export type SchoolAnalytics = {
  averagePercentage: number | null;
  passRate: number | null;
  scoredResults: number;
  studentCount: number;
  classCount: number;
  subjectAverages: SchoolSubjectAvg[];
  classAverages: SchoolClassAvg[];
  weakTopics: SchoolTopicStat[];
  strongTopics: SchoolTopicStat[];
  topStudents: SchoolTopStudent[];
};

export async function getSchoolAnalytics(schoolId: string): Promise<SchoolAnalytics> {
  const admin = createAdminClient();

  const [classesRes, subjectsRes, studentsRes, resultsRes, answersRes] =
    await Promise.all([
      admin
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("order", { ascending: true }),
      admin
        .from("subjects")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name", { ascending: true }),
      admin
        .from("students")
        .select("id, class_id")
        .eq("school_id", schoolId),
      admin
        .from("results")
        .select("id, percentage, subject_id, pass, students(id, display_name, class_id)")
        .eq("school_id", schoolId)
        .not("percentage", "is", null)
        .order("created_at", { ascending: false })
        .limit(2000),
      admin
        .from("examination_answers")
        .select("is_correct, examination_questions(questions(topic))")
        .eq("school_id", schoolId)
        .not("is_correct", "is", null)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

  const classNames = new Map<string, string>(
    ((classesRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
  );
  const subjectNames = new Map<string, string>(
    ((subjectsRes.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );

  type ResultRow = {
    percentage: number;
    subject_id: string | null;
    pass: boolean | null;
    students: Array<{ id: string; display_name: string | null; class_id: string | null }>;
  };
  const results = (resultsRes.data ?? []) as ResultRow[];

  const percentages = results.map((r) => r.percentage);
  const passed = results.filter((r) => r.pass).length;

  const subjectBuckets = new Map<string, { subjectId: string; total: number; count: number }>();
  for (const r of results) {
    if (!r.subject_id) continue;
    const bucket = subjectBuckets.get(r.subject_id) ?? {
      subjectId: r.subject_id,
      total: 0,
      count: 0,
    };
    bucket.total += r.percentage;
    bucket.count += 1;
    subjectBuckets.set(r.subject_id, bucket);
  }
  const subjectAverages: SchoolSubjectAvg[] = [...subjectBuckets.values()]
    .map((b) => ({
      subjectId: b.subjectId,
      subjectName: subjectNames.get(b.subjectId) ?? "Subject",
      average: Math.round(b.total / b.count),
      results: b.count,
    }))
    .sort((a, b) => b.average - a.average);

  const classBuckets = new Map<string, { classId: string; total: number; count: number }>();
  for (const r of results) {
    const classId = asArray(r.students)[0]?.class_id ?? "";
    const bucket = classBuckets.get(classId) ?? { classId, total: 0, count: 0 };
    bucket.total += r.percentage;
    bucket.count += 1;
    classBuckets.set(classId, bucket);
  }
  const classAverages: SchoolClassAvg[] = [...classBuckets.values()]
    .map((b) => ({
      classId: b.classId || null,
      className: b.classId ? classNames.get(b.classId) ?? "Unassigned" : "Unassigned",
      average: Math.round(b.total / b.count),
      results: b.count,
    }))
    .sort((a, b) => b.average - a.average);

  const studentBuckets = new Map<
    string,
    { studentId: string; name: string; className: string | null; total: number; count: number }
  >();
  for (const r of results) {
    const student = asArray(r.students)[0];
    if (!student) continue;
    const bucket = studentBuckets.get(student.id) ?? {
      studentId: student.id,
      name: student.display_name ?? "Student",
      className: student.class_id ? classNames.get(student.class_id) ?? null : null,
      total: 0,
      count: 0,
    };
    bucket.total += r.percentage;
    bucket.count += 1;
    studentBuckets.set(student.id, bucket);
  }
  const topStudents: SchoolTopStudent[] = [...studentBuckets.values()]
    .filter((b) => b.count > 0)
    .map((b) => ({
      studentId: b.studentId,
      displayName: b.name,
      className: b.className,
      average: Math.round(b.total / b.count),
      results: b.count,
    }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 10);

  const topicBuckets = new Map<string, { answers: number; correct: number }>();
  for (const a of (answersRes.data ?? []) as Array<{
    is_correct: boolean;
    examination_questions: Array<{ questions: Array<{ topic: string | null }> }>;
  }>) {
    const eq = asArray(a.examination_questions)[0];
    const topic = eq ? asArray(eq.questions)[0]?.topic ?? null : null;
    if (!topic) continue;
    const bucket = topicBuckets.get(topic) ?? { answers: 0, correct: 0 };
    bucket.answers += 1;
    if (a.is_correct) bucket.correct += 1;
    topicBuckets.set(topic, bucket);
  }

  const topicStats: SchoolTopicStat[] = [...topicBuckets.entries()]
    .filter(([, b]) => b.answers >= 5)
    .map(([topic, b]) => ({
      topic,
      average: Math.round((b.correct / b.answers) * 100),
      answers: b.answers,
    }));

  const sorted = [...topicStats].sort((a, b) => a.average - b.average);

  return {
    averagePercentage:
      percentages.length > 0
        ? Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length)
        : null,
    passRate: percentages.length > 0 ? Math.round((passed / percentages.length) * 100) : null,
    scoredResults: results.length,
    studentCount: (studentsRes.data ?? []).length,
    classCount: (classesRes.data ?? []).length,
    subjectAverages,
    classAverages,
    weakTopics: sorted.slice(0, 8),
    strongTopics: [...sorted].reverse().slice(0, 8),
    topStudents,
  };
}
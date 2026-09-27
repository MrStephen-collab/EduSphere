import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { asArray } from "@/lib/embed";

export type SchoolResultsFilters = {
  classId: string | null;
  subjectId: string | null;
  examinationId: string | null;
};

export type SchoolResultRow = {
  id: string;
  studentId: string;
  studentName: string | null;
  admissionNumber: string | null;
  className: string | null;
  subject: string | null;
  examination: string | null;
  score: number | null;
  percentage: number | null;
  pass: boolean | null;
  publishedAt: string | null;
};

type RawResult = {
  id: string;
  student_id: string;
  score: number | null;
  percentage: number | null;
  pass: boolean | null;
  published_at: string | null;
  students: {
    display_name: string | null;
    admission_number: string | null;
    classes: { name: string }[] | null;
  }[] | null;
  subjects: { name: string }[] | null;
  examinations: { title: string }[] | null;
};

export type ClassOrSubjectSummary = {
  label: string;
  count: number;
  average: number | null;
  passRate: number | null;
};

export type SchoolResultsData = {
  rows: SchoolResultRow[];
  total: number;
  average: number | null;
  highest: number | null;
  lowest: number | null;
  passRate: number | null;
  byClass: ClassOrSubjectSummary[];
  bySubject: ClassOrSubjectSummary[];
};

function isPassed(row: { pass: boolean | null; percentage: number | null }): boolean {
  if (row.pass != null) return row.pass;
  if (row.percentage != null) return row.percentage >= 50;
  return false;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

export async function getSchoolResults(
  schoolId: string,
  filters: SchoolResultsFilters,
): Promise<SchoolResultsData> {
  const supabase = await createSupabaseServerClient();
  const { classId, subjectId, examinationId } = filters;

  let studentIds: string[] | null = null;
  if (classId) {
    const { data } = await supabase
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .eq("class_id", classId);
    studentIds = (data ?? []).map((s) => s.id);
    if (studentIds.length === 0) {
      return {
        rows: [],
        total: 0,
        average: null,
        highest: null,
        lowest: null,
        passRate: null,
        byClass: [],
        bySubject: [],
      };
    }
  }

  let query = supabase
    .from("results")
    .select(
      "id, student_id, score, percentage, pass, published_at, students(display_name, admission_number, classes(name)), subjects(name), examinations(title)",
    )
    .eq("school_id", schoolId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(400);

  if (studentIds) query = query.in("student_id", studentIds);
  if (subjectId) query = query.eq("subject_id", subjectId);
  if (examinationId) query = query.eq("examination_id", examinationId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const raw = (data ?? []) as RawResult[];
  const rows: SchoolResultRow[] = raw.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: asArray(r.students)[0]?.display_name ?? null,
    admissionNumber: asArray(r.students)[0]?.admission_number ?? null,
    className: asArray(asArray(r.students)[0]?.classes)[0]?.name ?? null,
    subject: asArray(r.subjects)[0]?.name ?? null,
    examination: asArray(r.examinations)[0]?.title ?? null,
    score: r.score,
    percentage: r.percentage,
    pass: r.pass,
    publishedAt: r.published_at,
  }));

  const pcts = rows
    .map((r) => r.percentage)
    .filter((p): p is number => p != null);
  const valid = pcts.length > 0;
  const passed = rows.filter(isPassed).length;

  const group = (key: (r: SchoolResultRow) => string | null): ClassOrSubjectSummary[] => {
    const map = new Map<string, { count: number; pcts: number[]; passed: number }>();
    for (const r of rows) {
      const label = key(r) ?? "Unknown";
      const entry = map.get(label) ?? { count: 0, pcts: [] as number[], passed: 0 };
      entry.count += 1;
      if (r.percentage != null) entry.pcts.push(r.percentage);
      if (isPassed(r)) entry.passed += 1;
      map.set(label, entry);
    }
    return [...map.entries()]
      .map(([label, e]) => ({
        label,
        count: e.count,
        average: average(e.pcts),
        passRate: e.count ? Math.round((e.passed / e.count) * 100) : null,
      }))
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  };

  return {
    rows,
    total: rows.length,
    average: average(pcts),
    highest: valid ? Math.max(...pcts) : null,
    lowest: valid ? Math.min(...pcts) : null,
    passRate: rows.length ? Math.round((passed / rows.length) * 100) : null,
    byClass: group((r) => r.className),
    bySubject: group((r) => r.subject),
  };
}
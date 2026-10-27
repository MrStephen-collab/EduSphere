import { z } from "zod";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowExists } from "@/lib/supabase/queries";
import { requireContentEditor } from "@/services/shared";
import { asArray } from "@/lib/embed";
import {
  blankComments,
  defaultAffective,
  defaultPsychomotor,
  emptySubject,
  TRADITIONAL_DEFAULT_SUBJECTS,
  type TraditionalComments,
  type TraditionalReportData,
  type TraditionalSubjectRow,
  type TraditionalTraitRow,
} from "@/lib/traditional-report";
import type { Term, TraditionalReportCardRow } from "@/types/database";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TraditionalEntrySchool = {
  name: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  motto: string | null;
};

export type TraditionalEntryClass = { id: string; name: string };

export type TraditionalEntryTerm = {
  id: string;
  name: string;
  sessionId: string;
  sessionName: string;
  isCurrent: boolean;
};

export type TraditionalEntryStudent = {
  id: string;
  admissionNumber: string;
  displayName: string;
  gender: string | null;
  className: string | null;
  streamName: string | null;
};

export type TraditionalEntryContext = {
  school: TraditionalEntrySchool;
  classes: TraditionalEntryClass[];
  terms: TraditionalEntryTerm[];
  /** The school's subject names, or the printed template's defaults. */
  subjects: string[];
  defaultClassId: string | null;
  defaultTermId: string | null;
};

export type TraditionalReportRecord = {
  studentId: string;
  termId: string;
  data: TraditionalReportData;
  saved: boolean;
  savedAt: string | null;
  /** False when migration 0035 has not been applied to this database. */
  storageReady: boolean;
};

export type TraditionalReportSummary = {
  studentId: string;
  displayName: string;
  admissionNumber: string;
  cardId: string | null;
  updatedAt: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SessionRow = {
  id: string;
  name: string;
  is_current: boolean;
  created_at: string;
  terms:
    | { id: string; name: string; is_current: boolean; starts_at: string | null; ends_at: string | null; created_at: string }[]
    | { id: string; name: string; is_current: boolean; starts_at: string | null; ends_at: string | null; created_at: string }
    | null;
};

type StudentRow = {
  id: string;
  class_id: string | null;
  admission_number: string;
  display_name: string | null;
  gender: "male" | "female" | null;
  streams: { name: string } | { name: string }[] | null;
};

type SavedRow = TraditionalReportCardRow;

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    (error.message ?? "").includes("Could not find the table") ||
    (error.message ?? "").includes("schema cache")
  );
}

// ---------------------------------------------------------------------------
// Entry context (classes / terms / subjects / school identity)
// ---------------------------------------------------------------------------

export async function getTraditionalEntryContext(
  schoolId: string,
  teacherId: string | null = null,
): Promise<TraditionalEntryContext> {
  const supabase = await createSupabaseServerClient();

  const [{ data: school }, { data: classes }, { data: sessions }, { data: subjects }, { data: links }] =
    await Promise.all([
      supabase
        .from("schools")
        .select("name, address, phone, logo_url, motto")
        .eq("id", schoolId)
        .maybeSingle(),
      supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("academic_sessions")
        .select(
          "id, name, is_current, created_at, terms(id, name, is_current, starts_at, ends_at, created_at)",
        )
        .eq("school_id", schoolId)
        .order("is_current", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("subjects")
        .select("name")
        .eq("school_id", schoolId)
        .order("name", { ascending: true }),
      teacherId
        ? supabase
            .from("teacher_classes")
            .select("class_id")
            .eq("school_id", schoolId)
            .eq("teacher_id", teacherId)
        : Promise.resolve({ data: null }),
    ]);

  const linkedClassIds = teacherId
    ? new Set(((links ?? []) as { class_id: string }[]).map((l) => l.class_id))
    : null;

  const classRows = ((classes ?? []) as TraditionalEntryClass[]).filter(
    (c) => !linkedClassIds || linkedClassIds.has(c.id),
  );

  const terms: TraditionalEntryTerm[] = [];
  const sessionRows = (sessions ?? []) as SessionRow[];
  for (const session of sessionRows) {
    const sessionTerms = [...asArray(session.terms)].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    for (const term of sessionTerms) {
      terms.push({
        id: term.id,
        name: term.name,
        sessionId: session.id,
        sessionName: session.name,
        isCurrent: term.is_current,
      });
    }
  }

  const currentSession = sessionRows.find((s) => s.is_current);
  const defaultTerm =
    terms.find((t) => t.isCurrent && t.sessionId === currentSession?.id) ??
    terms.find((t) => t.isCurrent) ??
    terms[0] ??
    null;

  const subjectNames = ((subjects ?? []) as { name: string }[]).map((s) => s.name);

  // Land on a class that actually has students. Most schools have far more
  // classes than populated ones (JSS 1 may be empty while JSS 2 has a full
  // roll); defaulting to the first class by order made the entry form look
  // broken on an empty register. Keep the ordered default when every class is
  // empty so the "no students" message still explains itself.
  let defaultClassId = classRows[0]?.id ?? null;
  const classIds = classRows.map((c) => c.id);
  if (classIds.length > 0) {
    const { data: enrolled } = await supabase
      .from("students")
      .select("class_id")
      .eq("school_id", schoolId)
      .in("class_id", classIds)
      .not("class_id", "is", null)
      .limit(1000);
    const populated = new Set(
      ((enrolled ?? []) as { class_id: string | null }[])
        .map((s) => s.class_id)
        .filter((id): id is string => Boolean(id)),
    );
    defaultClassId = classRows.find((c) => populated.has(c.id))?.id ?? defaultClassId;
  }

  return {
    school: {
      name: school?.name ?? "School",
      address: school?.address ?? null,
      phone: school?.phone ?? null,
      logoUrl: school?.logo_url ?? null,
      motto: school?.motto ?? null,
    },
    classes: classRows,
    terms,
    subjects: subjectNames.length ? subjectNames : [...TRADITIONAL_DEFAULT_SUBJECTS],
    defaultClassId,
    defaultTermId: defaultTerm?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Students for a class
// ---------------------------------------------------------------------------

export async function getTraditionalStudents(
  schoolId: string,
  classId: string,
  teacherId: string | null = null,
): Promise<TraditionalEntryStudent[]> {
  const supabase = await createSupabaseServerClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!cls) return [];

  if (teacherId) {
    const linked = await rowExists(supabase, "teacher_classes", {
      school_id: schoolId,
      teacher_id: teacherId,
      class_id: classId,
    });
    if (!linked) return [];
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, admission_number, display_name, gender, class_id, streams(name)")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .order("admission_number", { ascending: true });

  return ((students ?? []) as StudentRow[]).map((s) => ({
    id: s.id,
    admissionNumber: s.admission_number,
    displayName: s.display_name ?? "Student",
    gender: s.gender,
    className: cls.name as string,
    streamName: asArray(s.streams)[0]?.name ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Attendance snapshot (days opened / present / absent)
// ---------------------------------------------------------------------------

async function loadAttendance(
  schoolId: string,
  classId: string,
  studentId: string,
  term: Pick<Term, "starts_at" | "ends_at">,
): Promise<{ daysOpened: number | null; daysPresent: number | null; daysAbsent: number | null }> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("attendance_records")
    .select("student_id, date, status")
    .eq("school_id", schoolId)
    .eq("class_id", classId);
  if (term.starts_at) query = query.gte("date", term.starts_at);
  if (term.ends_at) query = query.lte("date", term.ends_at);

  const { data } = await query;
  const rows = (data ?? []) as { student_id: string; date: string; status: string }[];
  if (rows.length === 0) {
    return { daysOpened: null, daysPresent: null, daysAbsent: null };
  }

  const classDays = new Set(rows.map((r) => r.date)).size;
  let present = 0;
  let absent = 0;
  for (const row of rows) {
    if (row.student_id !== studentId) continue;
    if (row.status === "present" || row.status === "late") present += 1;
    else if (row.status === "absent") absent += 1;
  }

  return {
    daysOpened: classDays,
    daysPresent: present,
    daysAbsent: absent,
  };
}

// ---------------------------------------------------------------------------
// Load one card, pre-filled from the student record when not saved yet
// ---------------------------------------------------------------------------

export async function getTraditionalReportCard(
  schoolId: string,
  studentId: string,
  termId: string,
  teacherId: string | null = null,
): Promise<TraditionalReportRecord | null> {
  const supabase = await createSupabaseServerClient();

  const { data: studentData } = await supabase
    .from("students")
    .select("id, class_id, admission_number, display_name, gender, streams(name)")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!studentData) return null;
  const student = studentData as StudentRow;

  if (teacherId && student.class_id) {
    const linked = await rowExists(supabase, "teacher_classes", {
      school_id: schoolId,
      teacher_id: teacherId,
      class_id: student.class_id,
    });
    if (!linked) return null;
  }

  const { data: termData } = await supabase
    .from("terms")
    .select("id, school_id, session_id, name, starts_at, ends_at, academic_sessions(name)")
    .eq("id", termId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!termData) return null;
  const term = termData as Term & {
    academic_sessions: { name: string } | { name: string }[] | null;
  };
  const sessionName = asArray(term.academic_sessions)[0]?.name ?? null;

  const [{ data: school }, { data: cls }, { data: subjects }, { data: savedData, error: savedError }, { count }] =
    await Promise.all([
      supabase
        .from("schools")
        .select("name, address, phone, logo_url, motto")
        .eq("id", schoolId)
        .maybeSingle(),
      student.class_id
        ? supabase
            .from("classes")
            .select("name")
            .eq("id", student.class_id)
            .eq("school_id", schoolId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("subjects")
        .select("name")
        .eq("school_id", schoolId)
        .order("name", { ascending: true }),
      supabase
        .from("traditional_report_cards")
        .select("*")
        .eq("school_id", schoolId)
        .eq("student_id", studentId)
        .eq("term_id", termId)
        .maybeSingle(),
      student.class_id
        ? supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("school_id", schoolId)
            .eq("class_id", student.class_id)
        : Promise.resolve({ count: 0 }),
    ]);

  const storageReady = !isMissingTable(savedError);
  const saved = (savedData as SavedRow | null) ?? null;
  const className = (cls as { name?: string } | null)?.name ?? null;
  const streamName = asArray(student.streams)[0]?.name ?? null;
  const roll = count && count > 0 ? count : null;

  const attendance = student.class_id
    ? await loadAttendance(schoolId, student.class_id, studentId, term)
    : { daysOpened: null as number | null, daysPresent: null as number | null, daysAbsent: null as number | null };

  const defaultSubjects: TraditionalSubjectRow[] =
    ((subjects ?? []) as { name: string }[]).length > 0
      ? ((subjects ?? []) as { name: string }[]).map((s) => emptySubject(s.name))
      : [...TRADITIONAL_DEFAULT_SUBJECTS].map((name) => emptySubject(name));

  const data: TraditionalReportData = {
    school: {
      name: school?.name ?? "School",
      address: school?.address ?? null,
      phone: school?.phone ?? null,
      logoUrl: school?.logo_url ?? null,
      motto: school?.motto ?? null,
    },
    student: {
      fullName: saved?.student_name ?? student.display_name ?? "Student",
      admissionNo: saved?.admission_number ?? student.admission_number,
      className: saved?.class_name ?? className ?? "",
      sex: saved?.sex ?? (student.gender ? student.gender.toUpperCase() : null),
      house: saved?.house ?? streamName,
      session: saved?.session_name ?? sessionName ?? "",
      term: saved?.term_name ?? term.name,
      noOnRoll: saved?.no_on_roll ?? roll,
      position: saved?.position ?? null,
      totalInClass: saved?.total_in_class ?? roll,
      daysOpened: saved?.days_opened ?? attendance.daysOpened,
      daysPresent: saved?.days_present ?? attendance.daysPresent,
      daysAbsent: saved?.days_absent ?? attendance.daysAbsent,
    },
    subjects: saved ? (saved.subjects ?? []) : defaultSubjects,
    affective: saved ? (saved.affective ?? []) : defaultAffective(),
    psychomotor: saved ? (saved.psychomotor ?? []) : defaultPsychomotor(),
    comments: saved?.comments ?? blankComments(),
    stampUrl: null,
  };

  return {
    studentId,
    termId,
    data,
    saved: Boolean(saved) && storageReady,
    savedAt: saved?.updated_at ?? null,
    storageReady,
  };
}

// ---------------------------------------------------------------------------
// Saved cards for a class + term (school management list)
// ---------------------------------------------------------------------------

export async function listTraditionalReportCards(
  schoolId: string,
  classId: string,
  termId: string,
  teacherId: string | null = null,
): Promise<TraditionalReportSummary[]> {
  const supabase = await createSupabaseServerClient();

  if (teacherId) {
    const linked = await rowExists(supabase, "teacher_classes", {
      school_id: schoolId,
      teacher_id: teacherId,
      class_id: classId,
    });
    if (!linked) return [];
  }

  const [{ data: students }, { data: cards, error }] = await Promise.all([
    supabase
      .from("students")
      .select("id, admission_number, display_name")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .order("admission_number", { ascending: true }),
    supabase
      .from("traditional_report_cards")
      .select("id, student_id, updated_at")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .eq("term_id", termId),
  ]);

  const byStudent = new Map(
    (isMissingTable(error) ? [] : ((cards ?? []) as { id: string; student_id: string; updated_at: string }[])).map(
      (c) => [c.student_id, c],
    ),
  );

  return ((students ?? []) as { id: string; admission_number: string; display_name: string | null }[]).map(
    (s) => {
      const card = byStudent.get(s.id);
      return {
        studentId: s.id,
        displayName: s.display_name ?? "Student",
        admissionNumber: s.admission_number,
        cardId: card?.id ?? null,
        updatedAt: card?.updated_at ?? null,
      };
    },
  );
}

// ---------------------------------------------------------------------------
// Save (upsert one card for a student + term)
// ---------------------------------------------------------------------------

const optionalNumber = z.number().finite().min(0).max(10000).nullable().optional();

const subjectSchema = z.object({
  name: z.string().trim().min(1, "A subject needs a name.").max(120),
  test1: optionalNumber,
  test2: optionalNumber,
  test3: optionalNumber,
  totalTests: optionalNumber,
  exam: optionalNumber,
  overall: optionalNumber,
  lastTerm: optionalNumber,
  cumulative: optionalNumber,
  classAvg: optionalNumber,
  position: optionalNumber,
  grade: z.string().trim().max(10).nullable().optional(),
  remark: z.string().trim().max(300).nullable().optional(),
  teacherSignature: z.string().trim().max(120).nullable().optional(),
});

const traitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  value: z.enum(["A", "B", "C", "D", "E"]).nullable().optional(),
});

const commentsSchema = z.object({
  classTeacher: z.string().max(4000).nullable().optional(),
  classTeacherName: z.string().max(160).nullable().optional(),
  classTeacherDate: z.string().max(40).nullable().optional(),
  principal: z.string().max(4000).nullable().optional(),
  principalName: z.string().max(160).nullable().optional(),
  principalDate: z.string().max(40).nullable().optional(),
  nextTermBegins: z.string().max(40).nullable().optional(),
});

const saveSchema = z.object({
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
  data: z.object({
    student: z.object({
      fullName: z.string().trim().min(1, "The student's name is required.").max(160),
      admissionNo: z.string().trim().max(60).nullable().optional(),
      className: z.string().trim().max(80).nullable().optional(),
      sex: z.string().trim().max(20).nullable().optional(),
      house: z.string().trim().max(40).nullable().optional(),
      session: z.string().trim().max(40).nullable().optional(),
      term: z.string().trim().max(40).nullable().optional(),
      noOnRoll: optionalNumber,
      position: optionalNumber,
      totalInClass: optionalNumber,
      daysOpened: optionalNumber,
      daysPresent: optionalNumber,
      daysAbsent: optionalNumber,
    }),
    subjects: z.array(subjectSchema).max(60),
    affective: z.array(traitSchema).max(40),
    psychomotor: z.array(traitSchema).max(40),
    comments: commentsSchema,
  }),
});

export type SaveTraditionalReportInput = z.input<typeof saveSchema>;

function cleanText(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

export async function saveTraditionalReportCard(input: SaveTraditionalReportInput): Promise<string> {
  const { schoolId, userId, role, teacherId } = await requireContentEditor();
  if (role !== "TEACHER" && role !== "SCHOOL_ADMIN" && role !== "SCHOOL_OWNER") {
    throw new Error("Only school staff can save report cards.");
  }

  const result = saveSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message ?? "Please check the report card fields.",
    );
  }
  const parsed = result.data;
  const admin = createAdminClient();

  const { data: studentData, error: studentError } = await admin
    .from("students")
    .select("id, school_id, class_id, admission_number, display_name, gender, streams(name)")
    .eq("id", parsed.studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (studentError) throw new Error("We couldn't load that student.");
  if (!studentData) throw new Error("That student doesn't belong to your school.");
  const student = studentData as StudentRow;

  const { data: termData } = await admin
    .from("terms")
    .select("id, school_id, session_id, name, starts_at, ends_at, academic_sessions(name)")
    .eq("id", parsed.termId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!termData) throw new Error("That term doesn't belong to your school.");
  const term = termData as Term & {
    academic_sessions: { name: string } | { name: string }[] | null;
  };

  let className: string | null = null;
  if (student.class_id) {
    const { data: cls } = await admin
      .from("classes")
      .select("name")
      .eq("id", student.class_id)
      .eq("school_id", schoolId)
      .maybeSingle();
    className = (cls as { name?: string } | null)?.name ?? null;
  }

  if (role === "TEACHER") {
    if (!student.class_id) {
      throw new Error("This student isn't enrolled in a class yet.");
    }
    const linked = await rowExists(admin, "teacher_classes", {
      school_id: schoolId,
      teacher_id: teacherId ?? "",
      class_id: student.class_id,
    });
    if (!linked) throw new Error("This class isn't assigned to you.");
  }

  const data = parsed.data;
  const sessionName = asArray(term.academic_sessions)[0]?.name ?? null;
  const streamName = asArray(student.streams)[0]?.name ?? null;

  const comments: TraditionalComments = {
    classTeacher: data.comments.classTeacher ?? "",
    classTeacherName: data.comments.classTeacherName ?? "",
    classTeacherDate: data.comments.classTeacherDate ?? "",
    principal: data.comments.principal ?? "",
    principalName: data.comments.principalName ?? "",
    principalDate: data.comments.principalDate ?? "",
    nextTermBegins: data.comments.nextTermBegins ?? "",
  };

  const subjects: TraditionalSubjectRow[] = data.subjects.map((s) => ({
    ...s,
    name: s.name.trim(),
  }));
  const affective: TraditionalTraitRow[] = data.affective.map((t) => ({
    name: t.name,
    value: t.value ?? null,
  }));
  const psychomotor: TraditionalTraitRow[] = data.psychomotor.map((t) => ({
    name: t.name,
    value: t.value ?? null,
  }));

  const row = {
    school_id: schoolId,
    student_id: student.id,
    class_id: student.class_id,
    term_id: term.id,
    student_name: data.student.fullName.trim() || student.display_name || "Student",
    admission_number: cleanText(data.student.admissionNo) ?? student.admission_number,
    class_name: cleanText(data.student.className) ?? className,
    sex:
      cleanText(data.student.sex) ??
      (student.gender ? student.gender.toUpperCase() : null),
    house: cleanText(data.student.house) ?? streamName,
    session_name: cleanText(data.student.session) ?? sessionName,
    term_name: cleanText(data.student.term) ?? term.name,
    no_on_roll: data.student.noOnRoll ?? null,
    position: data.student.position ?? null,
    total_in_class: data.student.totalInClass ?? null,
    days_opened: data.student.daysOpened ?? null,
    days_present: data.student.daysPresent ?? null,
    days_absent: data.student.daysAbsent ?? null,
    subjects,
    affective,
    psychomotor,
    comments,
    updated_by: userId,
  };

  const { data: existing, error: findError } = await admin
    .from("traditional_report_cards")
    .select("id")
    .eq("student_id", student.id)
    .eq("term_id", term.id)
    .maybeSingle();

  if (isMissingTable(findError)) {
    throw new Error(
      "Report card storage isn't set up yet. Apply supabase/migrations/0035_traditional_report_cards.sql, then try again.",
    );
  }
  if (findError) throw new Error("We couldn't check for an existing report card.");

  const existingId = (existing as { id?: string } | null)?.id;

  if (existingId) {
    const { data: updated, error } = await admin
      .from("traditional_report_cards")
      .update(row)
      .eq("id", existingId)
      .select("id")
      .single();
    if (error) throw new Error("We couldn't save this report card.");
    return (updated as { id: string }).id;
  }

  const { data: inserted, error } = await admin
    .from("traditional_report_cards")
    .insert({ ...row, created_by: userId })
    .select("id")
    .single();
  if (error) {
    if (isMissingTable(error)) {
      throw new Error(
        "Report card storage isn't set up yet. Apply supabase/migrations/0035_traditional_report_cards.sql, then try again.",
      );
    }
    if (error.code === "23505") {
      throw new Error("This report card was saved by someone else. Reload the page and try again.");
    }
    throw new Error("We couldn't save this report card.");
  }
  return (inserted as { id: string }).id;
}

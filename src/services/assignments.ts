import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireContentEditor } from "@/services/shared";
import { requireStudent } from "@/services/learning";
import {
  sendAssignmentCreatedEmails,
  sendAssignmentGradedEmail,
} from "@/email/hooks";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import { asArray } from "@/lib/embed";
import type {
  Assignment,
  AssignmentStatus,
  AssignmentSubmission,
  ContentStatus,
} from "@/types/database";

function invalidateAssignmentDashboards() {
  invalidateCacheByPrefix("dash:teacher:");
  invalidateCacheByPrefix("dash:student:");
  invalidateCacheByPrefix("dash:child-results:");
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const assignmentSchema = z.object({
  title: z.string().trim().min(2, "Assignment title is required").max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  instructions: z.string().trim().max(5000).optional().nullable(),
  classId: z.string().uuid("Choose a valid class").optional().nullable(),
  subjectId: z.string().uuid("Choose a valid subject").optional().nullable(),
  courseId: z.string().uuid("Choose a valid course").optional().nullable(),
  dueDate: z.string().trim().optional().nullable(),
  maxScore: z.coerce.number().min(1, "Max score must be at least 1").max(1000),
  attachmentUrl: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(["draft", "published"]).optional().default("draft"),
});

export const gradeSchema = z.object({
  score: z.coerce.number().min(0, "Score can't be negative"),
  feedback: z.string().trim().max(2000).optional().nullable(),
});

export const submissionSchema = z.object({
  submissionText: z.string().trim().max(20000).optional().nullable(),
  attachmentUrl: z.string().trim().max(1000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Teacher / admin assignment management
// ---------------------------------------------------------------------------

export type TeacherAssignmentRow = Assignment & {
  classes: { name: string } | { name: string }[] | null;
  subjects: { name: string } | { name: string }[] | null;
  courses: { title: string } | { title: string }[] | null;
};

export type TeacherAssignmentItem = {
  assignment: TeacherAssignmentRow;
  submissions: number;
  graded: number;
  pending: number;
};

function toDueDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function listTeacherAssignments(
  schoolId: string,
  userId: string,
  role: string,
): Promise<TeacherAssignmentItem[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("assignments")
    .select("*, classes(name), subjects(name), courses(title)")
    .eq("school_id", schoolId)
    .is("deleted_at", null);

  if (role === "TEACHER") {
    query = query.eq("created_by", userId);
  }

  const { data: rows, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const assignments = (rows ?? []) as TeacherAssignmentRow[];
  if (assignments.length === 0) return [];

  const ids = assignments.map((a) => a.id);
  const { data: subs } = await supabase
    .from("assignment_submissions")
    .select("assignment_id, status")
    .eq("school_id", schoolId)
    .in("assignment_id", ids);

  const counts = new Map<string, { submissions: number; graded: number }>();
  for (const s of subs ?? []) {
    const entry = counts.get(s.assignment_id) ?? { submissions: 0, graded: 0 };
    entry.submissions += 1;
    if (s.status === "graded") entry.graded += 1;
    counts.set(s.assignment_id, entry);
  }

  return assignments.map((assignment) => {
    const c = counts.get(assignment.id) ?? { submissions: 0, graded: 0 };
    return {
      assignment,
      submissions: c.submissions,
      graded: c.graded,
      pending: c.submissions - c.graded,
    };
  });
}

export type AssignmentDetail = {
  assignment: TeacherAssignmentRow;
  submissions: (AssignmentSubmission & {
    students: { display_name: string | null } | { display_name: string | null }[] | null;
  })[];
};

export async function getAssignmentDetail(
  schoolId: string,
  assignmentId: string,
  userId: string,
  role: string,
): Promise<AssignmentDetail | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("assignments")
    .select("*, classes(name), subjects(name), courses(title)")
    .eq("id", assignmentId)
    .eq("school_id", schoolId)
    .is("deleted_at", null);

  if (role === "TEACHER") {
    query = query.eq("created_by", userId);
  }

  const { data: assignment, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!assignment) return null;

  const { data: subs, error: subsError } = await supabase
    .from("assignment_submissions")
    .select("*, students(display_name)")
    .eq("assignment_id", assignmentId)
    .eq("school_id", schoolId)
    .order("submitted_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (subsError) throw new Error(subsError.message);

  return {
    assignment: assignment as TeacherAssignmentRow,
    submissions: (subs ?? []) as AssignmentDetail["submissions"],
  };
}

export async function createAssignment(
  input: z.infer<typeof assignmentSchema>,
): Promise<string> {
  invalidateAssignmentDashboards();
  const { schoolId, userId } = await requireContentEditor();
  const data = assignmentSchema.parse(input);
  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("assignments")
    .insert({
      school_id: schoolId,
      created_by: userId,
      class_id: data.classId ?? null,
      subject_id: data.subjectId ?? null,
      course_id: data.courseId ?? null,
      title: data.title,
      description: data.description ?? null,
      instructions: data.instructions ?? null,
      due_date: toDueDate(data.dueDate),
      max_score: data.maxScore,
      attachment_url: data.attachmentUrl ?? null,
      status: data.status,
    })
    .select("id")
    .single();
  if (error) throw new Error("We couldn't create this assignment.");

  await sendAssignmentCreatedEmails({
    schoolId,
    assignmentId: row.id,
    classId: data.classId ?? null,
    subjectId: data.subjectId ?? undefined,
    title: data.title,
    dueDate: data.dueDate ?? null,
    maxScore: data.maxScore,
  });

  return row.id;
}

export async function updateAssignment(
  id: string,
  input: Partial<z.infer<typeof assignmentSchema>>,
): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const data = assignmentSchema.partial().parse(input);
  const admin = createAdminClient();

  const patches: Record<string, unknown> = {};
  if (data.title !== undefined) patches.title = data.title;
  if (data.description !== undefined) patches.description = data.description ?? null;
  if (data.instructions !== undefined) patches.instructions = data.instructions ?? null;
  if (data.classId !== undefined) patches.class_id = data.classId ?? null;
  if (data.subjectId !== undefined) patches.subject_id = data.subjectId ?? null;
  if (data.courseId !== undefined) patches.course_id = data.courseId ?? null;
  if (data.dueDate !== undefined) patches.due_date = toDueDate(data.dueDate);
  if (data.maxScore !== undefined) patches.max_score = data.maxScore;
  if (data.attachmentUrl !== undefined) patches.attachment_url = data.attachmentUrl ?? null;

  const { error } = await admin
    .from("assignments")
    .update(patches)
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't update this assignment.");
}

export async function setAssignmentStatus(
  id: string,
  status: ContentStatus,
): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  const { error } = await admin
    .from("assignments")
    .update({ status })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't update this assignment.");
}

export async function deleteAssignment(id: string): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  const { error } = await admin
    .from("assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this assignment.");
}

export async function gradeSubmission(
  submissionId: string,
  input: z.infer<typeof gradeSchema>,
): Promise<void> {
  invalidateAssignmentDashboards();
  const { schoolId, userId, role } = await requireContentEditor();
  const data = gradeSchema.parse(input);

  // Admin client bypasses RLS, so enforce teacher ownership server-side too.
  const admin = createAdminClient();
  if (role === "TEACHER") {
    const { data: submission } = await admin
      .from("assignment_submissions")
      .select("assignment_id")
      .eq("id", submissionId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!submission) throw new Error("We couldn't find this submission.");

    const { data: assignment } = await admin
      .from("assignments")
      .select("created_by")
      .eq("id", submission.assignment_id)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (assignment?.created_by !== userId) {
      throw new Error("You can only grade submissions on your own assignments.");
    }
  }

  const { error } = await admin
    .from("assignment_submissions")
    .update({
      score: data.score,
      feedback: data.feedback ?? null,
      status: "graded",
      graded_at: new Date().toISOString(),
      graded_by: userId,
    })
    .eq("id", submissionId)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't save this grade.");

  await sendAssignmentGradedEmail({
    schoolId,
    submissionId,
  });
}

// ---------------------------------------------------------------------------
// Student experience
// ---------------------------------------------------------------------------

export type StudentAssignmentItem = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  maxScore: number;
  subject: string | null;
  className: string | null;
  courseTitle: string | null;
  status: AssignmentStatus;
  score: number | null;
  graded: boolean;
  overdue: boolean;
};

function studentStatusOf(
  submission: AssignmentSubmission | null | undefined,
  dueDate: string | null,
  now: Date,
): { status: AssignmentStatus; graded: boolean; overdue: boolean } {
  if (!submission) {
    const overdue = !!dueDate && now.getTime() > new Date(dueDate).getTime();
    return { status: overdue ? "late" : "not_started", graded: false, overdue };
  }
  const graded = submission.status === "graded";
  const submittedLate =
    !!dueDate &&
    !!submission.submitted_at &&
    now.getTime() > new Date(dueDate).getTime();
  return {
    status: submission.status === "graded" ? "graded" : submittedLate ? "late" : "submitted",
    graded,
    overdue: graded ? false : submittedLate,
  };
}

export async function getStudentAssignments(
  schoolId: string,
  studentId: string,
): Promise<StudentAssignmentItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  let query = supabase
    .from("assignments")
    .select("*, subjects(name), classes(name), courses(title)")
    .eq("school_id", schoolId)
    .eq("status", "published")
    .is("deleted_at", null);

  if (student?.class_id) {
    query = query.or(`class_id.eq.${student.class_id},class_id.is.null`);
  } else {
    query = query.is("class_id", null);
  }

  const { data: rows, error } = await query.order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);

  const assignments = (rows ?? []) as TeacherAssignmentRow[];
  if (assignments.length === 0) return [];

  const ids = assignments.map((a) => a.id);
  const { data: subs } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .in("assignment_id", ids);

  const byAssignment = new Map(
    (subs ?? []).map((s) => [s.assignment_id, s]),
  );
  const now = new Date();

  return assignments.map((a) => {
    const submission = (byAssignment.get(a.id) ?? null) as AssignmentSubmission | null;
    const state = studentStatusOf(submission, a.due_date, now);
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      dueDate: a.due_date,
      maxScore: a.max_score,
      subject: asArray(a.subjects)[0]?.name ?? null,
      className: asArray(a.classes)[0]?.name ?? null,
      courseTitle: asArray(a.courses)[0]?.title ?? null,
      status: state.status,
      score: submission?.score ?? null,
      graded: state.graded,
      overdue: state.overdue,
    };
  });
}

export type StudentAssignmentDetail = {
  assignment: TeacherAssignmentRow | null;
  visible: boolean;
  submission: AssignmentSubmission | null;
};

export async function getStudentAssignmentDetail(
  schoolId: string,
  studentId: string,
  assignmentId: string,
): Promise<StudentAssignmentDetail> {
  const supabase = await createSupabaseServerClient();

  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  const { data: assignment, error } = await supabase
    .from("assignments")
    .select("*, subjects(name), classes(name), courses(title)")
    .eq("id", assignmentId)
    .eq("school_id", schoolId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!assignment) return { assignment: null, visible: false, submission: null };
  const visible =
    !assignment.class_id || assignment.class_id === (student?.class_id ?? null);

  const { data: submission } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("school_id", schoolId)
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .maybeSingle();

  return {
    assignment: assignment as TeacherAssignmentRow,
    visible,
    submission: (submission ?? null) as AssignmentSubmission | null,
  };
}

async function getSubmissionId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  studentId: string,
  assignmentId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("assignment_submissions")
    .select("id")
    .eq("school_id", schoolId)
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function saveSubmissionDraft(
  schoolId: string,
  studentId: string,
  assignmentId: string,
  input: z.infer<typeof submissionSchema>,
): Promise<void> {
  const { studentId: guardId } = await requireStudent();
  if (guardId !== studentId) redirect("/dashboard");

  const data = submissionSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const existingId = await getSubmissionId(supabase, schoolId, studentId, assignmentId);

  const payload = {
    submission_text: data.submissionText ?? null,
    attachment_url: data.attachmentUrl ?? null,
  };

  const { error } = existingId
    ? await supabase
        .from("assignment_submissions")
        .update({ ...payload, status: "draft" })
        .eq("id", existingId)
    : await supabase.from("assignment_submissions").insert({
        school_id: schoolId,
        assignment_id: assignmentId,
        student_id: studentId,
        ...payload,
        status: "draft",
      });
  if (error) throw new Error("We couldn't save your draft.");
}

export async function submitAssignment(
  schoolId: string,
  studentId: string,
  assignmentId: string,
  input: z.infer<typeof submissionSchema>,
): Promise<void> {
  const { studentId: guardId } = await requireStudent();
  if (guardId !== studentId) redirect("/dashboard");

  const data = submissionSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const existingId = await getSubmissionId(supabase, schoolId, studentId, assignmentId);

  const payload = {
    submission_text: data.submissionText ?? null,
    attachment_url: data.attachmentUrl ?? null,
    status: "submitted" as const,
    submitted_at: new Date().toISOString(),
  };

  const { error } = existingId
    ? await supabase.from("assignment_submissions").update(payload).eq("id", existingId)
    : await supabase.from("assignment_submissions").insert({
        school_id: schoolId,
        assignment_id: assignmentId,
        student_id: studentId,
        ...payload,
      });
  if (error) throw new Error("We couldn't submit your assignment.");
}
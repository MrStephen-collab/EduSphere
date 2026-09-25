import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireContentEditor } from "@/services/shared";
import { requireStudent } from "@/services/learning";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import type {
  AttemptStatus,
  ContentStatus,
  ExamSection,
  ExamSeries,
  ExamSeriesType,
  PracticeAttempt,
  Question,
  QuestionDifficulty,
  QuestionOption,
  QuestionType,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export {
  examTypeLabels,
  difficultyLabels,
  questionTypeLabels,
  type SelectOption,
} from "@/lib/exam-labels";

export const examSeriesSchema = z.object({
  title: z.string().trim().min(2, "Series title is required").max(160),
  examType: z.enum(["common_entrance", "waec", "neco", "jamb", "school"]),
  year: z.string().trim().max(40).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  subjectId: z.string().uuid("Choose a valid subject").optional().nullable(),
  classId: z.string().uuid("Choose a valid class").optional().nullable(),
  status: z.enum(["draft", "published"]).optional().default("draft"),
  durationMinutes: z.coerce
    .number()
    .int("Duration must be a whole number of minutes")
    .min(1, "Duration is at least 1 minute")
    .max(600, "Max duration is 10 hours")
    .optional()
    .nullable(),
  shuffleQuestions: z.boolean().optional().default(false),
});

export const questionOptionSchema = z.object({
  text: z.string().trim().min(1, "Option text is required").max(500),
  isCorrect: z.boolean().optional().default(false),
});

export const questionSchema = z
  .object({
    questionText: z.string().trim().min(3, "Question text is required").max(2000),
    questionType: z
      .enum(["multiple_choice", "true_false", "multiple_answer", "essay"])
      .optional()
      .default("multiple_choice"),
    answerGuide: z.string().trim().max(4000).optional().nullable(),
    topic: z.string().trim().max(160).optional().nullable(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
    marks: z.coerce.number().min(1, "Marks must be at least 1").max(1000).optional().default(1),
    explanation: z.string().trim().max(2000).optional().nullable(),
    sectionId: z.string().uuid().optional().nullable(),
    options: z
      .array(questionOptionSchema)
      .max(6, "A maximum of six options is allowed")
      .optional()
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.questionType === "essay") return;
    if (data.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Add at least two options",
      });
    }
    if (!data.options.some((o) => o.isCorrect)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Mark at least one option as the correct answer",
      });
    }
  });

export const practiceAnswerSchema = z
  .object({
    questionId: z.string().uuid(),
    optionId: z.string().uuid().optional().nullable(),
    answerText: z.string().trim().max(20000, "Your answer is too long.").optional().nullable(),
  })
  .refine((a) => Boolean(a.optionId) || Boolean(a.answerText?.trim()), {
    message: "Provide an option or a written answer for the question.",
  });

// ---------------------------------------------------------------------------
// Row / result helpers
// ---------------------------------------------------------------------------

export type ExamSeriesListItem = ExamSeries & {
  subjects: { name: string } | null;
  classes: { name: string } | null;
  question_banks?: { questions?: { id: string }[] | null }[] | null;
};

export type SeriesQuestionList = (Question & { options: QuestionOption[] })[];

export type ExamSectionItem = ExamSection & { questionCount: number };

export type ExamSeriesDetail = {
  series: ExamSeriesListItem | null;
  banks: { id: string; name: string; description: string | null }[];
  questions: SeriesQuestionList;
  sections: ExamSectionItem[];
};

export type PracticeReviewItem = {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  topic: string | null;
  difficulty: QuestionDifficulty;
  marks: number;
  explanation: string | null;
  answerText: string | null;
  options: {
    id: string;
    text: string;
    correct: boolean;
    selected: boolean;
  }[];
  isCorrect: boolean | null;
  marksAwarded: number | null;
};

export type PracticeResult = {
  attemptId: string;
  seriesId: string;
  score: number;
  totalMarks: number;
  correct: number;
  wrong: number;
  pendingCount: number;
  status: AttemptStatus;
  timeUsedSeconds: number;
  startedAt: string;
  submittedAt: string;
  items: PracticeReviewItem[];
};

function questionCountOf(list: ExamSeriesListItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of list) {
    const total = (item.question_banks ?? []).reduce(
      (sum, bank) => sum + (bank.questions?.length ?? 0),
      0,
    );
    map.set(item.id, total);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Teacher / admin exam series management
// ---------------------------------------------------------------------------

export async function listExamSeries(
  schoolId: string,
  userId: string,
  role: string,
): Promise<{ series: ExamSeriesListItem; questionCount: number }[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("exam_series")
    .select("*, subjects(name), classes(name), question_banks(questions(id))")
    .eq("school_id", schoolId)
    .is("deleted_at", null);

  if (role === "TEACHER") {
    query = query.eq("created_by", userId);
  }

  const { data: rows, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const list = (rows ?? []) as ExamSeriesListItem[];
  const counts = questionCountOf(list);
  return list.map((series) => ({ series, questionCount: counts.get(series.id) ?? 0 }));
}

export async function getExamSeriesDetail(
  schoolId: string,
  seriesId: string,
  userId: string,
  role: string,
): Promise<ExamSeriesDetail> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("exam_series")
    .select("*, subjects(name), classes(name)")
    .eq("id", seriesId)
    .eq("school_id", schoolId)
    .is("deleted_at", null);

  if (role === "TEACHER") {
    query = query.eq("created_by", userId);
  }

  const { data: series, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!series) return { series: null, banks: [], questions: [], sections: [] };

  const { data: sectionRows, error: sectionError } = await supabase
    .from("exam_sections")
    .select("*")
    .eq("school_id", schoolId)
    .eq("series_id", seriesId)
    .order("position", { ascending: true });
  if (sectionError) throw new Error(sectionError.message);

  const { data: banks, error: banksError } = await supabase
    .from("question_banks")
    .select("id, name, description")
    .eq("school_id", schoolId)
    .eq("exam_series_id", seriesId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (banksError) throw new Error(banksError.message);

  const bankIds = (banks ?? []).map((b) => b.id);
  const questions: SeriesQuestionList = [];

  if (bankIds.length > 0) {
    const { data: qRows, error: qError } = await supabase
      .from("questions")
      .select("*")
      .eq("school_id", schoolId)
      .in("question_bank_id", bankIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (qError) throw new Error(qError.message);

    const questionRows = (qRows ?? []) as Question[];
    if (questionRows.length > 0) {
      const questionIds = questionRows.map((q) => q.id);
      const { data: optionRows, error: optError } = await supabase
        .from("question_options")
        .select("*")
        .eq("school_id", schoolId)
        .in("question_id", questionIds)
        .order("position", { ascending: true });
      if (optError) throw new Error(optError.message);

      const optionsByQuestion = new Map<string, QuestionOption[]>();
      for (const opt of optionRows ?? []) {
        const list = optionsByQuestion.get(opt.question_id) ?? [];
        list.push(opt);
        optionsByQuestion.set(opt.question_id, list);
      }
      for (const q of questionRows) {
        questions.push({ ...q, options: optionsByQuestion.get(q.id) ?? [] });
      }
    }
  }

  const sectionList = (sectionRows ?? []) as ExamSection[];

  return {
    series: series as ExamSeriesListItem,
    banks: (banks ?? []) as { id: string; name: string; description: string | null }[],
    questions,
    sections: sectionList.map((section) => {
      const sectionId = section.id;
      return {
        ...section,
        questionCount: questions.filter((q) => q.section_id === sectionId).length,
      };
    }),
  };
}

export async function createExamSeries(
  input: z.infer<typeof examSeriesSchema>,
): Promise<string> {
  const { schoolId, userId } = await requireContentEditor();
  const data = examSeriesSchema.parse(input);
  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("exam_series")
    .insert({
      school_id: schoolId,
      created_by: userId,
      exam_type: data.examType,
      title: data.title,
      year: data.year ?? null,
      description: data.description ?? null,
      subject_id: data.subjectId ?? null,
      class_id: data.classId ?? null,
      status: data.status,
      duration_minutes: data.durationMinutes ?? null,
      shuffle_questions: data.shuffleQuestions ?? false,
    })
    .select("id")
    .single();
  if (error) throw new Error("We couldn't create this exam series.");

  const { error: bankError } = await admin.from("question_banks").insert({
    school_id: schoolId,
    exam_series_id: row.id,
    name: data.title,
    subject_id: data.subjectId ?? null,
    class_id: data.classId ?? null,
    description: data.description ?? null,
    status: data.status,
    created_by: userId,
  });
  if (bankError) throw new Error("We couldn't create the series question bank.");

  return row.id;
}

export async function updateExamSeries(
  id: string,
  input: Partial<z.infer<typeof examSeriesSchema>>,
): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const data = examSeriesSchema.partial().parse(input);
  const admin = createAdminClient();

  const patches: Record<string, unknown> = {};
  if (data.title !== undefined) patches.title = data.title;
  if (data.examType !== undefined) patches.exam_type = data.examType;
  if (data.year !== undefined) patches.year = data.year ?? null;
  if (data.description !== undefined) patches.description = data.description ?? null;
  if (data.subjectId !== undefined) patches.subject_id = data.subjectId ?? null;
  if (data.classId !== undefined) patches.class_id = data.classId ?? null;
  if (data.durationMinutes !== undefined) patches.duration_minutes = data.durationMinutes ?? null;
  if (data.shuffleQuestions !== undefined) patches.shuffle_questions = data.shuffleQuestions ?? false;

  const { error } = await admin
    .from("exam_series")
    .update(patches)
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't update this exam series.");
}

export async function setExamSeriesStatus(
  id: string,
  status: ContentStatus,
): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  const { error } = await admin
    .from("exam_series")
    .update({ status })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't update this exam series.");
}

export async function deleteExamSeries(id: string): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: banks } = await admin
    .from("question_banks")
    .select("id")
    .eq("school_id", schoolId)
    .eq("exam_series_id", id)
    .is("deleted_at", null);

  const bankIds = (banks ?? []).map((b) => b.id);

  if (bankIds.length > 0) {
    const [qError, bError] = await Promise.all([
      admin
        .from("questions")
        .update({ deleted_at: now })
        .eq("school_id", schoolId)
        .in("question_bank_id", bankIds),
      admin
        .from("question_banks")
        .update({ deleted_at: now })
        .eq("school_id", schoolId)
        .in("id", bankIds),
    ]);
    if (qError.error || bError.error) {
      throw new Error("We couldn't delete this exam series.");
    }
  }

  const { error } = await admin
    .from("exam_series")
    .update({ deleted_at: now })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this exam series.");
}

// ---------------------------------------------------------------------------
// Section management (CBT papers)
// ---------------------------------------------------------------------------

export const sectionSchema = z.object({
  title: z.string().trim().min(2, "Section title is required").max(160),
  instructions: z.string().trim().max(1000).optional().nullable(),
  position: z.coerce.number().int().min(0).optional(),
});

async function assertSeriesInSchool(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  schoolId: string,
  seriesId: string,
): Promise<void> {
  const { data: series } = await admin
    .from("exam_series")
    .select("id")
    .eq("id", seriesId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!series) throw new Error("This exam series isn't available.");
}

export async function createSection(
  seriesId: string,
  input: z.infer<typeof sectionSchema>,
): Promise<string> {
  const { schoolId } = await requireContentEditor();
  const data = sectionSchema.parse(input);
  const admin = createAdminClient();
  await assertSeriesInSchool(admin, schoolId, seriesId);

  const { data: last } = await admin
    .from("exam_sections")
    .select("position")
    .eq("school_id", schoolId)
    .eq("series_id", seriesId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: row, error } = await admin
    .from("exam_sections")
    .insert({
      school_id: schoolId,
      series_id: seriesId,
      title: data.title,
      instructions: data.instructions ?? null,
      position: (last?.position ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) throw new Error("We couldn't create this section.");
  return row.id;
}

export async function updateSection(
  id: string,
  seriesId: string,
  input: z.infer<typeof sectionSchema>["title"] extends never
    ? never
    : { title?: string; instructions?: string | null; position?: number },
): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  await assertSeriesInSchool(admin, schoolId, seriesId);

  const safe = z
    .object({
      title: sectionSchema.shape.title,
      instructions: sectionSchema.shape.instructions,
      position: sectionSchema.shape.position,
    })
    .partial()
    .parse(input ?? {});

  const patches: Record<string, unknown> = {};
  if (safe.title !== undefined) patches.title = safe.title;
  if (safe.instructions !== undefined) patches.instructions = safe.instructions ?? null;
  if (safe.position !== undefined) patches.position = safe.position;

  const { error } = await admin
    .from("exam_sections")
    .update(patches)
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't update this section.");
}

export async function deleteSection(id: string, seriesId: string): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  await assertSeriesInSchool(admin, schoolId, seriesId);

  const { error } = await admin
    .from("exam_sections")
    .delete()
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this section.");
}

// ---------------------------------------------------------------------------
// Question management
// ---------------------------------------------------------------------------

async function getSeriesBankId(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  schoolId: string,
  seriesId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("question_banks")
    .select("id")
    .eq("school_id", schoolId)
    .eq("exam_series_id", seriesId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function assertSectionInSeries(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  schoolId: string,
  seriesId: string,
  sectionId: string,
): Promise<void> {
  const { data: section } = await admin
    .from("exam_sections")
    .select("id")
    .eq("id", sectionId)
    .eq("school_id", schoolId)
    .eq("series_id", seriesId)
    .maybeSingle();
  if (!section) throw new Error("This section doesn't belong to the exam series.");
}

async function seriesIdOfQuestion(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  schoolId: string,
  questionId: string,
): Promise<string | null> {
  const { data: question } = await admin
    .from("questions")
    .select("question_bank_id")
    .eq("id", questionId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!question?.question_bank_id) return null;
  const { data: bank } = await admin
    .from("question_banks")
    .select("exam_series_id")
    .eq("id", question.question_bank_id)
    .eq("school_id", schoolId)
    .maybeSingle();
  return bank?.exam_series_id ?? null;
}

export async function addQuestion(
  seriesId: string,
  input: z.infer<typeof questionSchema>,
): Promise<string> {
  const { schoolId, userId } = await requireContentEditor();
  const data = questionSchema.parse(input);
  const admin = createAdminClient();

  const { data: series } = await admin
    .from("exam_series")
    .select("subject_id, class_id")
    .eq("id", seriesId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!series) throw new Error("We couldn't find this exam series.");

  const bankId = await getSeriesBankId(admin, schoolId, seriesId);
  if (!bankId) throw new Error("This series has no question bank yet.");

  if (data.sectionId) await assertSectionInSeries(admin, schoolId, seriesId, data.sectionId);

  const { data: question, error } = await admin
    .from("questions")
    .insert({
      school_id: schoolId,
      question_bank_id: bankId,
      subject_id: series.subject_id,
      class_id: series.class_id,
      section_id: data.sectionId ?? null,
      question_text: data.questionText,
      question_type: data.questionType,
      answer_guide: data.questionType === "essay" ? (data.answerGuide ?? null) : null,
      topic: data.topic ?? null,
      difficulty: data.difficulty,
      marks: data.marks,
      explanation: data.explanation ?? null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error("We couldn't save this question.");

  if (data.questionType !== "essay" && data.options.length > 0) {
    const options = data.options.map((opt, index) => ({
      school_id: schoolId,
      question_id: question.id,
      option_text: opt.text,
      is_correct: opt.isCorrect ?? false,
      position: index,
    }));
    const { error: optError } = await admin.from("question_options").insert(options);
    if (optError) throw new Error("We couldn't save the answer options.");
  }

  return question.id;
}

export async function updateQuestion(
  id: string,
  input: z.infer<typeof questionSchema>,
): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const data = questionSchema.parse(input);
  const admin = createAdminClient();

  if (data.sectionId) {
    const seriesId = await seriesIdOfQuestion(admin, schoolId, id);
    if (seriesId) await assertSectionInSeries(admin, schoolId, seriesId, data.sectionId);
  }

  const { error } = await admin
    .from("questions")
    .update({
      question_text: data.questionText,
      question_type: data.questionType,
      answer_guide: data.questionType === "essay" ? (data.answerGuide ?? null) : null,
      topic: data.topic ?? null,
      difficulty: data.difficulty,
      marks: data.marks,
      explanation: data.explanation ?? null,
      section_id: data.sectionId ?? null,
    })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't save this question.");

  await admin
    .from("question_options")
    .delete()
    .eq("question_id", id)
    .eq("school_id", schoolId);

  if (data.questionType !== "essay" && data.options.length > 0) {
    const options = data.options.map((opt, index) => ({
      school_id: schoolId,
      question_id: id,
      option_text: opt.text,
      is_correct: opt.isCorrect ?? false,
      position: index,
    }));
    const { error: optError } = await admin.from("question_options").insert(options);
    if (optError) throw new Error("We couldn't save the answer options.");
  }
}

export async function deleteQuestion(id: string): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  const { error } = await admin
    .from("questions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this question.");
}

// ---------------------------------------------------------------------------
// Student experience
// ---------------------------------------------------------------------------

export type StudentSeriesItem = {
  id: string;
  examType: ExamSeriesType;
  title: string;
  year: string | null;
  description: string | null;
  subject: string | null;
  className: string | null;
  questionCount: number;
  attempts: number;
  bestScore: number | null;
  durationMinutes: number | null;
  shuffleQuestions: boolean;
  sectionsCount: number;
};

export async function getStudentExamSeries(
  schoolId: string,
  studentId: string,
): Promise<StudentSeriesItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  let query = supabase
    .from("exam_series")
    .select("*, subjects(name), classes(name), question_banks(questions(id))")
    .eq("school_id", schoolId)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (student?.class_id) {
    query = query.or(`class_id.eq.${student.class_id},class_id.is.null`);
  } else {
    query = query.is("class_id", null);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const list = (rows ?? []) as ExamSeriesListItem[];
  if (list.length === 0) return [];

  const counts = questionCountOf(list);
  const seriesIds = list.map((s) => s.id);

  const { data: attempts } = await supabase
    .from("practice_attempts")
    .select("exam_series_id, score")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .in("exam_series_id", seriesIds);

  const bySeries = new Map<string, { attempts: number; best: number | null }>();
  for (const row of attempts ?? []) {
    const entry = bySeries.get(row.exam_series_id) ?? { attempts: 0, best: null };
    entry.attempts += 1;
    if (row.score !== null && (entry.best === null || row.score > entry.best)) {
      entry.best = row.score;
    }
    bySeries.set(row.exam_series_id, entry);
  }

  const { data: sections } = await supabase
    .from("exam_sections")
    .select("series_id")
    .eq("school_id", schoolId)
    .in("series_id", seriesIds);
  const sectionsBySeries = new Map<string, number>();
  for (const row of sections ?? []) {
    sectionsBySeries.set(row.series_id, (sectionsBySeries.get(row.series_id) ?? 0) + 1);
  }

  return list.map((series) => {
    const stats = bySeries.get(series.id) ?? { attempts: 0, best: null };
    return {
      id: series.id,
      examType: series.exam_type,
      title: series.title,
      year: series.year,
      description: series.description,
      subject: series.subjects?.name ?? null,
      className: series.classes?.name ?? null,
      questionCount: counts.get(series.id) ?? 0,
      attempts: stats.attempts,
      bestScore: stats.best,
      durationMinutes: series.duration_minutes ?? null,
      shuffleQuestions: series.shuffle_questions,
      sectionsCount: sectionsBySeries.get(series.id) ?? 0,
    };
  });
}

export type StudentSeriesDetail = {
  series: StudentSeriesItem | null;
  visible: boolean;
  attempts: PracticeAttempt[];
  sections: { id: string; title: string; instructions: string | null }[];
};

export async function getStudentSeriesDetail(
  schoolId: string,
  studentId: string,
  seriesId: string,
): Promise<StudentSeriesDetail> {
  const items = await getStudentExamSeries(schoolId, studentId);
  const item = items.find((s) => s.id === seriesId) ?? null;

  if (!item) return { series: null, visible: false, attempts: [], sections: [] };

  const [attemptResult, sectionsResult] = await Promise.all([
    supabasePracticeAttempts(schoolId, studentId, seriesId),
    createSupabaseServerClient().then((supabase) =>
      supabase
        .from("exam_sections")
        .select("id, title, instructions")
        .eq("school_id", schoolId)
        .eq("series_id", seriesId)
        .order("position", { ascending: true }),
    ),
  ]);

  if (attemptResult.error) throw new Error(attemptResult.error.message);

  const attempts = ((attemptResult.data ?? []) as PracticeAttempt[]).filter(
    (a) => a.status !== "in_progress",
  );

  return {
    series: item,
    visible: true,
    attempts,
    sections: (sectionsResult.data ?? []) as { id: string; title: string; instructions: string | null }[],
  };
}

async function supabasePracticeAttempts(
  schoolId: string,
  studentId: string,
  seriesId: string,
) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("practice_attempts")
    .select("*")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("exam_series_id", seriesId)
    .order("created_at", { ascending: false });
}

export type PracticeQuestionItem = {
  id: string;
  questionText: string;
  questionType: QuestionType;
  topic: string | null;
  difficulty: QuestionDifficulty;
  marks: number;
  sectionId: string | null;
  sectionTitle: string | null;
  options: { id: string; text: string }[];
};

export type PracticePaper = {
  seriesId: string;
  title: string;
  examType: ExamSeriesType;
  subject: string | null;
  className: string | null;
  questionCount: number;
  totalMarks: number;
  durationMinutes: number | null;
  shuffleQuestions: boolean;
  sections: { id: string; title: string; instructions: string | null }[];
  questions: PracticeQuestionItem[];
};

function shuffleList<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function getPracticePaper(
  schoolId: string,
  seriesId: string,
  studentId: string,
): Promise<PracticePaper | null> {
  const detail = await getStudentSeriesDetail(schoolId, studentId, seriesId);
  if (!detail.visible || !detail.series) return null;

  const supabase = await createSupabaseServerClient();

  const emptyPaper = (series: StudentSeriesItem): PracticePaper => ({
    seriesId: series.id,
    title: series.title,
    examType: series.examType,
    subject: series.subject,
    className: series.className,
    questionCount: 0,
    totalMarks: 0,
    durationMinutes: series.durationMinutes,
    shuffleQuestions: series.shuffleQuestions,
    sections: [],
    questions: [],
  });

  const { data: banks } = await supabase
    .from("question_banks")
    .select("id")
    .eq("school_id", schoolId)
    .eq("exam_series_id", seriesId)
    .is("deleted_at", null);
  const bankIds = (banks ?? []).map((b) => b.id);

  if (bankIds.length === 0) return emptyPaper(detail.series);

  const { data: qRows } = await supabase
    .from("questions")
    .select("*")
    .eq("school_id", schoolId)
    .in("question_bank_id", bankIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  const questionRows = (qRows ?? []) as Question[];

  if (questionRows.length === 0) return emptyPaper(detail.series);

  const objectiveIds = questionRows
    .filter((q) => q.question_type !== "essay")
    .map((q) => q.id);

  const optionsByQuestion = new Map<string, PracticeQuestionItem["options"]>();
  if (objectiveIds.length > 0) {
    const { data: optionRows } = await supabase
      .from("question_options")
      .select("id, question_id, option_text")
      .eq("school_id", schoolId)
      .in("question_id", objectiveIds)
      .order("position", { ascending: true });
    for (const opt of optionRows ?? []) {
      const list = optionsByQuestion.get(opt.question_id) ?? [];
      list.push({ id: opt.id, text: opt.option_text });
      optionsByQuestion.set(opt.question_id, list);
    }
  }

  const sectionTitles = new Map<string, string>();
  for (const section of detail.sections) sectionTitles.set(section.id, section.title);

  const sections: PracticePaper["sections"] = detail.sections.map((s) => ({
    id: s.id,
    title: s.title,
    instructions: s.instructions,
  }));

  const buckets = new Map<string | null, PracticeQuestionItem[]>();
  for (const q of questionRows) {
    if (q.question_type === "essay") {
      const key = q.section_id ?? null;
      const list = buckets.get(key) ?? [];
      list.push({
        id: q.id,
        questionText: q.question_text,
        questionType: "essay",
        topic: q.topic,
        difficulty: q.difficulty,
        marks: q.marks,
        sectionId: q.section_id,
        sectionTitle: q.section_id ? sectionTitles.get(q.section_id) ?? null : null,
        options: [],
      });
      buckets.set(key, list);
      continue;
    }
    const options = optionsByQuestion.get(q.id) ?? [];
    if (options.length < 2) continue;
    const key = q.section_id ?? null;
    const list = buckets.get(key) ?? [];
    list.push({
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      topic: q.topic,
      difficulty: q.difficulty,
      marks: q.marks,
      sectionId: q.section_id,
      sectionTitle: q.section_id ? sectionTitles.get(q.section_id) ?? null : null,
      options,
    });
    buckets.set(key, list);
  }

  const orders = new Map<string, number>();
  detail.sections.forEach((s, index) => orders.set(s.id, index));

  const questions: PracticeQuestionItem[] = [];
  const ranked: { bucket: string | null; items: PracticeQuestionItem[] }[] = [];
  for (const [key, items] of buckets) {
    ranked.push({ bucket: key, items: detail.series.shuffleQuestions ? shuffleList(items) : items });
  }
  ranked.sort((a, b) => {
    const aKey = a.bucket;
    const bKey = b.bucket;
    if (aKey === null && bKey === null) return 0;
    if (aKey === null) return 1;
    if (bKey === null) return -1;
    return (orders.get(aKey) ?? 0) - (orders.get(bKey) ?? 0);
  });
  for (const group of ranked) questions.push(...group.items);

  return {
    seriesId,
    title: detail.series.title,
    examType: detail.series.examType,
    subject: detail.series.subject,
    className: detail.series.className,
    questionCount: questions.length,
    totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
    durationMinutes: detail.series.durationMinutes,
    shuffleQuestions: detail.series.shuffleQuestions,
    sections,
    questions,
  };
}

// ---------------------------------------------------------------------------
// Starting, timing and auto-marking a practice attempt (CBT)
// ---------------------------------------------------------------------------

export type ActivePractice = {
  seriesId: string;
  attemptId: string;
  startedAt: string;
  durationMinutes: number | null;
  elapsedSeconds: number;
  timedOut: boolean;
};

export async function startOrResumePracticeAttempt(
  schoolId: string,
  seriesId: string,
  studentId: string,
): Promise<ActivePractice | null> {
  const { studentId: guardStudentId } = await requireStudent();
  if (guardStudentId !== studentId) throw new Error("This attempt isn't yours.");

  const admin = createAdminClient();

  const { data: series } = await admin
    .from("exam_series")
    .select("*")
    .eq("id", seriesId)
    .eq("school_id", schoolId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (!series) return null;

  const { data: student } = await admin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!student) return null;

  const visible =
    !series.class_id || (!!student.class_id && series.class_id === student.class_id);
  if (!visible) return null;

  const { data: existing } = await admin
    .from("practice_attempts")
    .select("*")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("exam_series_id", seriesId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const durationMinutes: number | null = series.duration_minutes;
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  if (existing) {
    const startedMs = new Date(existing.started_at).getTime();
    const elapsedSeconds = Math.floor((nowMs - startedMs) / 1000);
    const timedOut = durationMinutes !== null && elapsedSeconds > durationMinutes * 60;

    if (!timedOut) {
      return {
        seriesId,
        attemptId: existing.id,
        startedAt: existing.started_at,
        durationMinutes: existing.duration_minutes,
        elapsedSeconds,
        timedOut: false,
      };
    }

    await admin
      .from("practice_attempts")
      .update({
        status: "timed_out",
        submitted_at: existing.started_at,
        time_used_seconds: durationMinutes * 60,
      })
      .eq("id", existing.id)
      .eq("school_id", schoolId);
  }

  const { data: attempt, error } = await admin
    .from("practice_attempts")
    .insert({
      school_id: schoolId,
      exam_series_id: seriesId,
      student_id: studentId,
      status: "in_progress",
      started_at: nowIso,
      duration_minutes: durationMinutes,
    })
    .select("id")
    .single();
  if (error) throw new Error("We couldn't start your attempt.");

  return {
    seriesId,
    attemptId: attempt.id,
    startedAt: nowIso,
    durationMinutes,
    elapsedSeconds: 0,
    timedOut: false,
  };
}

export async function submitPracticeAttempt(
  attemptId: string,
  answers: z.infer<typeof practiceAnswerSchema>[],
): Promise<PracticeResult> {
  invalidateCacheByPrefix("dash:student:");
  invalidateCacheByPrefix("dash:child-results:");
  const { schoolId, studentId } = await requireStudent();
  const safeAnswers = z.array(practiceAnswerSchema).parse(answers ?? []);
  const admin = createAdminClient();

  const { data: attempt } = await admin
    .from("practice_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!attempt) throw new Error("This attempt isn't yours.");
  if (attempt.status !== "in_progress") {
    throw new Error("This attempt has already been submitted.");
  }

  const seriesId = attempt.exam_series_id;

  const { data: student } = await admin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!student) redirect("/dashboard");

  const { data: series } = await admin
    .from("exam_series")
    .select("class_id")
    .eq("id", seriesId)
    .eq("school_id", schoolId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (!series) throw new Error("This exam series isn't available.");
  const visible =
    !series.class_id || (!!student.class_id && series.class_id === student.class_id);
  if (!visible) throw new Error("This exam series isn't available for your class.");

  const { data: banks } = await admin
    .from("question_banks")
    .select("id")
    .eq("school_id", schoolId)
    .eq("exam_series_id", seriesId)
    .is("deleted_at", null);
  const bankIds = (banks ?? []).map((b) => b.id);

  let questions: (Question & { options: QuestionOption[] })[] = [];
  if (bankIds.length > 0) {
    const { data: qRows } = await admin
      .from("questions")
      .select("*")
      .eq("school_id", schoolId)
      .in("question_bank_id", bankIds)
      .is("deleted_at", null);
    const qList = (qRows ?? []) as Question[];
    if (qList.length > 0) {
      const ids = qList.map((q) => q.id);
      const { data: optRows } = await admin
        .from("question_options")
        .select("*")
        .eq("school_id", schoolId)
        .in("question_id", ids)
        .order("position", { ascending: true });
      const byQuestion = new Map<string, QuestionOption[]>();
      for (const opt of optRows ?? []) {
        const list = byQuestion.get(opt.question_id) ?? [];
        list.push(opt);
        byQuestion.set(opt.question_id, list);
      }
      questions = qList
        .map((q) => ({ ...q, options: byQuestion.get(q.id) ?? [] }))
        .filter((q) => q.options.length >= 2);
    }
  }

  const byQuestionOption = new Map<string, string>();
  const byQuestionText = new Map<string, string>();
  for (const a of safeAnswers) {
    if (a.optionId) byQuestionOption.set(a.questionId, a.optionId);
    if (a.answerText?.trim()) byQuestionText.set(a.questionId, a.answerText.trim());
  }

  const nowMs = Date.now();
  const startedMs = new Date(attempt.started_at).getTime();
  const durationMinutes = attempt.duration_minutes;
  const elapsedSeconds = Math.floor((nowMs - startedMs) / 1000);
  const timedOut = durationMinutes !== null && elapsedSeconds > durationMinutes * 60;
  const status: AttemptStatus = timedOut ? "timed_out" : "submitted";
  const timeUsedSeconds = timedOut ? durationMinutes * 60 : Math.max(elapsedSeconds, 0);

  const items: PracticeReviewItem[] = [];
  let totalMarks = 0;
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let pendingCount = 0;

  for (const q of questions) {
    if (q.question_type === "essay") {
      const answered = byQuestionText.get(q.id) ?? null;
      totalMarks += q.marks;
      if (answered != null) pendingCount += 1;
      items.push({
        questionId: q.id,
        questionText: q.question_text,
        questionType: "essay",
        topic: q.topic,
        difficulty: q.difficulty,
        marks: q.marks,
        explanation: q.explanation,
        answerText: answered,
        options: [],
        isCorrect: null,
        marksAwarded: null,
      });
      continue;
    }

    const selectedId = byQuestionOption.get(q.id);
    const correctOption = q.options.find((o) => o.is_correct) ?? null;
    const selectedIsCorrect =
      !!selectedId &&
      !!correctOption &&
      q.options.some((o) => o.id === selectedId) &&
      selectedId === correctOption.id;

    const marksAwarded = selectedIsCorrect ? q.marks : 0;
    totalMarks += q.marks;
    score += marksAwarded;
    if (selectedIsCorrect) correct += 1;
    else wrong += 1;

    items.push({
      questionId: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      topic: q.topic,
      difficulty: q.difficulty,
      marks: q.marks,
      explanation: q.explanation,
      answerText: null,
      options: q.options.map((o) => ({
        id: o.id,
        text: o.option_text,
        correct: o.is_correct,
        selected: o.id === selectedId,
      })),
      isCorrect: selectedIsCorrect ? true : selectedId ? false : null,
      marksAwarded,
    });
  }

  const submittedAt = new Date(nowMs).toISOString();

  const { error: attemptError } = await admin
    .from("practice_attempts")
    .update({
      status,
      submitted_at: submittedAt,
      score,
      total_marks: totalMarks,
      correct_count: correct,
      wrong_count: wrong,
      time_used_seconds: timeUsedSeconds,
    })
    .eq("id", attemptId)
    .eq("school_id", schoolId)
    .eq("status", "in_progress");
  if (attemptError) throw new Error("We couldn't store your attempt.");

  const objectiveAnswerRows = questions
    .filter((q) => q.question_type !== "essay" && byQuestionOption.has(q.id))
    .map((q) => {
      const item = items.find((i) => i.questionId === q.id);
      return {
        school_id: schoolId,
        attempt_id: attemptId,
        question_id: q.id,
        selected_option_id: byQuestionOption.get(q.id) ?? null,
        is_correct: item?.isCorrect ?? null,
        marks_awarded: item?.marksAwarded ?? 0,
        answered_at: submittedAt,
      };
    });

  const essayAnswerRows = questions
    .filter((q) => q.question_type === "essay")
    .map((q) => {
      const item = items.find((i) => i.questionId === q.id);
      return {
        school_id: schoolId,
        attempt_id: attemptId,
        question_id: q.id,
        selected_option_id: null,
        answer_text: item?.answerText ?? null,
        is_correct: null,
        marks_awarded: null,
        answered_at: submittedAt,
      };
    });

  const answerRows = [...objectiveAnswerRows, ...essayAnswerRows];
  if (answerRows.length > 0) {
    const { error: answerError } = await admin.from("practice_answers").insert(answerRows);
    if (answerError) throw new Error("We couldn't save your answers.");
  }

  return {
    attemptId,
    seriesId,
    score,
    totalMarks,
    correct,
    wrong,
    pendingCount,
    status,
    timeUsedSeconds,
    startedAt: attempt.started_at,
    submittedAt,
    items,
  };
}

// ---------------------------------------------------------------------------
// Essay / Paper-2 marking (teacher side)
// ---------------------------------------------------------------------------

export type MarkingQueueItem = {
  attemptId: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  submittedAt: string | null;
  essayCount: number;
  pendingCount: number;
  autoScore: number | null;
  autoTotal: number | null;
};

export type EssayReviewAnswer = {
  answerId: string;
  questionId: string;
  questionText: string;
  marks: number;
  answerGuide: string | null;
  answerText: string | null;
  marksAwarded: number | null;
  markedAt: string | null;
};

export type AttemptForMarking = {
  attemptId: string;
  seriesId: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  submittedAt: string | null;
  autoScore: number | null;
  autoTotal: number | null;
  essayAnswers: EssayReviewAnswer[];
};

async function assertSeriesOwnership(
  schoolId: string,
  seriesId: string,
  userId: string,
  role: string,
): Promise<void> {
  if (role === "super_admin" || role === "school_admin") return;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("exam_series")
    .select("created_by")
    .eq("id", seriesId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!data || data.created_by !== userId) {
    throw new Error("You don't have permission to mark this series.");
  }
}

export async function getSeriesMarkingQueue(
  schoolId: string,
  seriesId: string,
): Promise<{ seriesTitle: string; pendingAttempts: number; items: MarkingQueueItem[] }> {
  const { userId, role } = await requireContentEditor();
  await assertSeriesOwnership(schoolId, seriesId, userId, role);

  const supabase = await createSupabaseServerClient();

  const { data: series } = await supabase
    .from("exam_series")
    .select("title")
    .eq("id", seriesId)
    .eq("school_id", schoolId)
    .maybeSingle();

  const { data: attemptRows } = await supabase
    .from("practice_attempts")
    .select(
      "id, student_id, submitted_at, score, total_marks, students!inner(id, display_name, admission_number, classes(name))",
    )
    .eq("school_id", schoolId)
    .eq("exam_series_id", seriesId)
    .in("status", ["submitted", "timed_out"])
    .order("submitted_at", { ascending: false });
  const attempts = (attemptRows ?? []) as {
    id: string;
    student_id: string;
    submitted_at: string | null;
    score: number | null;
    total_marks: number | null;
    students: {
      display_name: string | null;
      admission_number: string;
      classes: { name: string }[] | null;
    }[];
  }[];

  if (attempts.length === 0) {
    return { seriesTitle: series?.title ?? "", pendingAttempts: 0, items: [] };
  }

  const attemptIds = attempts.map((a) => a.id);
  const { data: answerRows } = await supabase
    .from("practice_answers")
    .select("id, attempt_id, marks_awarded, questions!inner(id, question_type, marks)")
    .eq("school_id", schoolId)
    .in("attempt_id", attemptIds)
    .eq("questions.question_type", "essay");
  const answers = (answerRows ?? []) as {
    attempt_id: string;
    marks_awarded: number | null;
    questions: { id: string; question_type: QuestionType; marks: number }[];
  }[];

  const stats = new Map<string, { essayCount: number; pending: number }>();
  for (const row of answers) {
    if (row.questions[0]?.question_type !== "essay") continue;
    const entry = stats.get(row.attempt_id) ?? { essayCount: 0, pending: 0 };
    entry.essayCount += 1;
    if (row.marks_awarded == null) entry.pending += 1;
    stats.set(row.attempt_id, entry);
  }

  const items = attempts.flatMap((a) => {
    const s = stats.get(a.id);
    if (!s || s.essayCount === 0) return [];
    return [
      {
        attemptId: a.id,
        studentName: a.students[0]?.display_name ?? "Student",
        admissionNumber: a.students[0]?.admission_number ?? "",
        className: a.students[0]?.classes?.[0]?.name ?? null,
        submittedAt: a.submitted_at,
        essayCount: s.essayCount,
        pendingCount: s.pending,
        autoScore: a.score,
        autoTotal: a.total_marks,
      },
    ];
  });

  return {
    seriesTitle: series?.title ?? "",
    pendingAttempts: items.reduce((sum, i) => sum + i.pendingCount, 0),
    items,
  };
}

export async function getAttemptForMarking(
  schoolId: string,
  seriesId: string,
  attemptId: string,
): Promise<AttemptForMarking | null> {
  const { userId, role } = await requireContentEditor();
  await assertSeriesOwnership(schoolId, seriesId, userId, role);

  const supabase = await createSupabaseServerClient();

  const { data: attempt } = await supabase
    .from("practice_attempts")
    .select(
      "id, submitted_at, score, total_marks, students!inner(id, display_name, admission_number, classes(name))",
    )
    .eq("id", attemptId)
    .eq("school_id", schoolId)
    .eq("exam_series_id", seriesId)
    .maybeSingle();
  if (!attempt) return null;

  const { data: answerRows } = await supabase
    .from("practice_answers")
    .select("id, attempt_id, answer_text, marks_awarded, marked_at, questions!inner(id, question_type, question_text, marks, answer_guide)")
    .eq("school_id", schoolId)
    .eq("attempt_id", attemptId)
    .eq("questions.question_type", "essay")
    .order("answered_at", { ascending: true });
  const answers = (answerRows ?? []) as {
    id: string;
    answer_text: string | null;
    marks_awarded: number | null;
    marked_at: string | null;
    questions: {
      id: string;
      question_type: QuestionType;
      question_text: string;
      marks: number;
      answer_guide: string | null;
    }[];
  }[];

  return {
    attemptId: attempt.id,
    seriesId,
    studentName: attempt.students[0]?.display_name ?? "Student",
    admissionNumber: attempt.students[0]?.admission_number ?? "",
    className: attempt.students[0]?.classes?.[0]?.name ?? null,
    submittedAt: attempt.submitted_at,
    autoScore: attempt.score,
    autoTotal: attempt.total_marks,
    essayAnswers: answers
      .filter((a) => a.questions[0]?.question_type === "essay")
      .map((a) => ({
        answerId: a.id,
        questionId: a.questions[0].id,
        questionText: a.questions[0].question_text,
        marks: a.questions[0].marks,
        answerGuide: a.questions[0].answer_guide,
        answerText: a.answer_text ?? null,
        marksAwarded: a.marks_awarded,
        markedAt: a.marked_at,
      })),
  };
}

export const essayMarkSchema = z.object({
  answerId: z.string().uuid(),
  marksAwarded: z.coerce.number().min(0, "Marks can't be negative").max(1000),
});

export async function saveEssayMarks(
  attemptId: string,
  marks: { answerId: string; marksAwarded: number }[],
): Promise<void> {
  const { schoolId, userId, role } = await requireContentEditor();
  const safeMarks = z.array(essayMarkSchema).parse(marks ?? []);

  const supabase = await createSupabaseServerClient();
  const { data: attempt } = await supabase
    .from("practice_attempts")
    .select("exam_series_id")
    .eq("id", attemptId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!attempt) throw new Error("This attempt doesn't exist.");
  await assertSeriesOwnership(schoolId, attempt.exam_series_id, userId, role);

  const admin = createAdminClient();
  const ids = safeMarks.map((m) => m.answerId);

  const { data: answers } = await admin
    .from("practice_answers")
    .select("id, question_id, marks_awarded, questions!inner(marks)")
    .eq("school_id", schoolId)
    .eq("attempt_id", attemptId)
    .eq("question_type", "essay")
    .in("id", ids);
  const answersList = (answers ?? []) as {
    id: string;
    question_id: string;
    questions: { marks: number }[];
  }[];
  const found = new Set(answersList.map((a) => a.id));
  for (const m of safeMarks) {
    if (!found.has(m.answerId)) throw new Error("One of the answers couldn't be found.");
  }

  const marksById = new Map(safeMarks.map((m) => [m.answerId, m.marksAwarded]));
  const nowIso = new Date().toISOString();

  for (const a of answersList) {
    const awarded = Math.min(marksById.get(a.id) ?? 0, a.questions[0]?.marks ?? 0);
    const { error } = await admin
      .from("practice_answers")
      .update({
        marks_awarded: awarded,
        marked_by: userId,
        marked_at: nowIso,
      })
      .eq("id", a.id)
      .eq("school_id", schoolId);
    if (error) throw new Error("We couldn't save the marks.");
  }

  const { data: finalAnswers } = await admin
    .from("practice_answers")
    .select("marks_awarded")
    .eq("school_id", schoolId)
    .eq("attempt_id", attemptId);
  const score = (finalAnswers ?? []).reduce(
    (sum, a) => sum + (a.marks_awarded ?? 0),
    0,
  );

  const { error: attemptError } = await admin
    .from("practice_attempts")
    .update({ score })
    .eq("id", attemptId)
    .eq("school_id", schoolId);
  if (attemptError) throw new Error("We couldn't update the attempt score.");
}
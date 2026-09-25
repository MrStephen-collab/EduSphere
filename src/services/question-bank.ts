import { z } from "zod";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireContentEditor } from "@/services/shared";
import { questionSchema } from "@/services/exam";

export const bankCreateSchema = z.object({
  name: z.string().trim().min(3, "Bank name is required").max(120),
  description: z.string().trim().max(400).optional().nullable(),
  subjectId: z.string().uuid().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
});

export type BankQuestionOption = {
  id: string;
  optionText: string;
  isCorrect: boolean;
};

export type BankQuestion = {
  id: string;
  questionText: string;
  questionType: string;
  topic: string | null;
  difficulty: string;
  marks: number;
  explanation: string | null;
  createdAt: string;
  options: BankQuestionOption[];
};

export type QuestionBankSummary = {
  id: string;
  name: string;
  description: string | null;
  subjectName: string | null;
  className: string | null;
  questionCount: number;
  authorName: string | null;
  createdAt: string;
};

export type QuestionBankDetail = QuestionBankSummary & {
  questions: BankQuestion[];
};

const SUMMARY_SELECT =
  "id, name, description, subject_id, class_id, created_by, created_at, subjects(name), classes(name), profiles(name)";

type BankRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
  subjects: Array<{ name: string }>;
  classes: Array<{ name: string }>;
  profiles: Array<{ name: string | null }>;
};

function toSummary(row: BankRow, count: number): QuestionBankSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    subjectName: row.subjects[0]?.name ?? null,
    className: row.classes[0]?.name ?? null,
    questionCount: count,
    authorName: row.profiles[0]?.name ?? null,
    createdAt: row.created_at,
  };
}

export async function getQuestionBanks(
  schoolId: string,
): Promise<QuestionBankSummary[]> {
  const supabase = await createSupabaseServerClient();

  const [banksRes, countsRes] = await Promise.all([
    supabase
      .from("question_banks")
      .select(SUMMARY_SELECT)
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
    supabase
      .from("questions")
      .select("question_bank_id")
      .eq("school_id", schoolId)
      .is("deleted_at", null),
  ]);

  const counts = new Map<string, number>();
  for (const row of (countsRes.data ?? []) as Array<{ question_bank_id: string | null }>) {
    if (row.question_bank_id) {
      counts.set(row.question_bank_id, (counts.get(row.question_bank_id) ?? 0) + 1);
    }
  }

  return ((banksRes.data ?? []) as BankRow[]).map((b) =>
    toSummary(b, counts.get(b.id) ?? 0),
  );
}

export async function getQuestionBankDetail(
  schoolId: string,
  bankId: string,
): Promise<QuestionBankDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: bank } = await supabase
    .from("question_banks")
    .select(SUMMARY_SELECT)
    .eq("school_id", schoolId)
    .eq("id", bankId)
    .maybeSingle();
  if (!bank) return null;

  const row = bank as BankRow;

  const { data: questions } = await supabase
    .from("questions")
    .select(
      "id, question_text, question_type, topic, difficulty, marks, explanation, created_at",
    )
    .eq("school_id", schoolId)
    .eq("question_bank_id", bankId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const questionRows = (questions ?? []) as Array<{
    id: string;
    question_text: string;
    question_type: string;
    topic: string | null;
    difficulty: string;
    marks: number;
    explanation: string | null;
    created_at: string;
  }>;

  const ids = questionRows.map((q) => q.id);
  const { data: optionRows } =
    ids.length > 0
      ? await supabase
          .from("question_options")
          .select("id, question_id, option_text, is_correct")
          .eq("school_id", schoolId)
          .in("question_id", ids)
          .order("position", { ascending: true })
      : { data: [] };

  const byQuestion = new Map<string, BankQuestionOption[]>();
  for (const o of (optionRows ?? []) as Array<{
    id: string;
    question_id: string;
    option_text: string;
    is_correct: boolean;
  }>) {
    const list = byQuestion.get(o.question_id) ?? [];
    list.push({ id: o.id, optionText: o.option_text, isCorrect: o.is_correct });
    byQuestion.set(o.question_id, list);
  }

  const questionsList: BankQuestion[] = questionRows.map((q) => ({
    id: q.id,
    questionText: q.question_text,
    questionType: q.question_type,
    topic: q.topic,
    difficulty: q.difficulty,
    marks: q.marks,
    explanation: q.explanation,
    createdAt: q.created_at,
    options: byQuestion.get(q.id) ?? [],
  }));

  return {
    ...toSummary(row, questionsList.length),
    questions: questionsList,
  };
}

export async function createQuestionBank(
  input: z.infer<typeof bankCreateSchema>,
): Promise<string> {
  const { schoolId, userId } = await requireContentEditor();
  const data = bankCreateSchema.parse(input);
  const admin = createAdminClient();

  const { data: bank, error } = await admin
    .from("question_banks")
    .insert({
      school_id: schoolId,
      name: data.name,
      subject_id: data.subjectId ?? null,
      class_id: data.classId ?? null,
      description: data.description ?? null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error("We couldn't create this question bank.");
  return bank.id;
}

export async function deleteQuestionBank(id: string): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();

  const { data: linked } = await admin
    .from("exam_series")
    .select("id")
    .eq("school_id", schoolId)
    .eq("question_bank_id", id)
    .limit(1);
  if ((linked ?? []).length > 0) {
    throw new Error(
      "This bank is used by an exam series, so it can't be deleted.",
    );
  }

  const { error } = await admin
    .from("question_banks")
    .delete()
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this question bank.");
}

export async function addBankQuestion(
  bankId: string,
  input: z.infer<typeof questionSchema>,
): Promise<string> {
  const { schoolId, userId } = await requireContentEditor();
  const data = questionSchema.parse(input);
  const admin = createAdminClient();

  const { data: bank } = await admin
    .from("question_banks")
    .select("subject_id, class_id")
    .eq("id", bankId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!bank) throw new Error("We couldn't find this question bank.");

  const { data: question, error } = await admin
    .from("questions")
    .insert({
      school_id: schoolId,
      question_bank_id: bankId,
      subject_id: bank.subject_id,
      class_id: bank.class_id,
      section_id: null,
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

export async function deleteBankQuestion(id: string): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  const { error } = await admin
    .from("questions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this question.");
}
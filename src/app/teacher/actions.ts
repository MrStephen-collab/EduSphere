"use server";

import { revalidatePath } from "next/cache";
import {
  createCourse,
  updateCourse,
  setCourseStatus,
  deleteCourse,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
  updateLesson,
  setLessonStatus,
  deleteLesson,
  createMaterial,
  deleteMaterial,
} from "@/services/learning";
import {
  createAssignment,
  updateAssignment,
  setAssignmentStatus,
  deleteAssignment,
  gradeSubmission,
} from "@/services/assignments";
import {
  createExamSeries,
  updateExamSeries,
  setExamSeriesStatus,
  deleteExamSeries,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  createSection,
  updateSection,
  deleteSection,
  saveEssayMarks,
} from "@/services/exam";
import { saveClassRegister } from "@/services/attendance";
import {
  createQuestionBank,
  deleteQuestionBank,
  addBankQuestion,
  deleteBankQuestion,
} from "@/services/question-bank";
import type { ContentCategory, ContentStatus } from "@/types/database";

export type ActionState =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

async function run(
  fn: () => Promise<string | void>,
  paths: string[],
): Promise<ActionState> {
  try {
    const id = await fn();
    for (const path of paths) revalidatePath(path);
    return { ok: true, id: id ?? undefined };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

export async function createCourseAction(input: {
  title: string;
  description?: string | null;
  subjectId?: string | null;
  classId?: string | null;
  contentType?: ContentCategory | null;
  status?: ContentStatus;
}): Promise<ActionState> {
  return run(
    async () => {
      const id = await createCourse({
        title: input.title,
        description: input.description,
        subjectId: input.subjectId,
        classId: input.classId,
        contentType: input.contentType,
        status: input.status === "published" ? "published" : "draft",
      });
      return id;
    },
    ["/teacher/courses"],
  );
}

export async function updateCourseAction(
  id: string,
  input: {
    title?: string;
    description?: string | null;
    subjectId?: string | null;
    classId?: string | null;
    contentType?: ContentCategory | null;
  },
): Promise<ActionState> {
  return run(
    async () => {
      await updateCourse(id, input);
    },
    [`/teacher/courses/${id}`, "/teacher/courses"],
  );
}

export async function setCourseStatusAction(
  id: string,
  status: ContentStatus,
): Promise<ActionState> {
  return run(
    async () => {
      await setCourseStatus(id, status);
    },
    [`/teacher/courses/${id}`, "/teacher/courses"],
  );
}

export async function deleteCourseAction(id: string): Promise<ActionState> {
  return run(
    async () => {
      await deleteCourse(id);
    },
    ["/teacher/courses"],
  );
}

export async function createModuleAction(input: {
  courseId: string;
  title: string;
  description?: string | null;
  order?: number;
}): Promise<ActionState> {
  return run(
    async () => {
      await createModule({
        courseId: input.courseId,
        title: input.title,
        description: input.description,
        order: input.order ?? 0,
      });
    },
    [`/teacher/courses/${input.courseId}`],
  );
}

export async function updateModuleAction(
  id: string,
  courseId: string,
  input: { title?: string; description?: string | null; order?: number },
): Promise<ActionState> {
  return run(
    async () => {
      await updateModule(id, input);
    },
    [`/teacher/courses/${courseId}`],
  );
}

export async function deleteModuleAction(id: string, courseId: string): Promise<ActionState> {
  return run(
    async () => {
      await deleteModule(id);
    },
    [`/teacher/courses/${courseId}`],
  );
}

export async function createLessonAction(input: {
  courseId: string;
  moduleId?: string | null;
  title: string;
  description?: string | null;
  content?: string | null;
  videoUrl?: string | null;
  contentType?: ContentCategory | null;
  status?: ContentStatus;
}): Promise<ActionState> {
  return run(
    async () => {
      const id = await createLesson({
        courseId: input.courseId,
        moduleId: input.moduleId,
        title: input.title,
        description: input.description,
        content: input.content,
        videoUrl: input.videoUrl,
        contentType: input.contentType,
        status: input.status === "published" ? "published" : "draft",
      });
      return id;
    },
    [`/teacher/courses/${input.courseId}`],
  );
}

export async function updateLessonAction(
  id: string,
  courseId: string,
  input: {
    title?: string;
    description?: string | null;
    content?: string | null;
    videoUrl?: string | null;
    moduleId?: string | null;
    contentType?: ContentCategory | null;
  },
): Promise<ActionState> {
  return run(
    async () => {
      await updateLesson(id, input);
    },
    [`/teacher/courses/${courseId}/lessons/${id}`, `/teacher/courses/${courseId}`],
  );
}

export async function setLessonStatusAction(
  id: string,
  courseId: string,
  status: ContentStatus,
): Promise<ActionState> {
  return run(
    async () => {
      await setLessonStatus(id, status);
    },
    [`/teacher/courses/${courseId}/lessons/${id}`, `/teacher/courses/${courseId}`],
  );
}

export async function deleteLessonAction(id: string, courseId: string): Promise<ActionState> {
  return run(
    async () => {
      await deleteLesson(id);
    },
    [`/teacher/courses/${courseId}`],
  );
}

export async function createMaterialAction(input: {
  lessonId: string;
  courseId: string;
  title: string;
  fileType?: string;
  fileUrl?: string | null;
  isPublic?: boolean;
}): Promise<ActionState> {
  return run(
    async () => {
      await createMaterial({
        lessonId: input.lessonId,
        title: input.title,
        fileType: input.fileType as "link" | "pdf" | "doc" | "docx" | "ppt" | "pptx" | "image" | "audio" | "video" | "text" | "other",
        fileUrl: input.fileUrl,
        isPublic: input.isPublic ?? false,
      });
    },
    [`/teacher/courses/${input.courseId}/lessons/${input.lessonId}`],
  );
}

export async function deleteMaterialAction(
  id: string,
  lessonId: string,
  courseId: string,
): Promise<ActionState> {
  return run(
    async () => {
      await deleteMaterial(id);
    },
    [`/teacher/courses/${courseId}/lessons/${lessonId}`],
  );
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

type AssignmentInput = {
  title: string;
  description?: string | null;
  instructions?: string | null;
  classId?: string | null;
  subjectId?: string | null;
  courseId?: string | null;
  dueDate?: string | null;
  maxScore: number;
  attachmentUrl?: string | null;
  status?: ContentStatus;
};

export async function createAssignmentAction(input: AssignmentInput): Promise<ActionState> {
  return run(
    async () => {
      const id = await createAssignment({
        title: input.title,
        description: input.description,
        instructions: input.instructions,
        classId: input.classId,
        subjectId: input.subjectId,
        courseId: input.courseId,
        dueDate: input.dueDate,
        maxScore: input.maxScore,
        attachmentUrl: input.attachmentUrl,
        status: input.status === "published" ? "published" : "draft",
      });
      return id;
    },
    ["/teacher/assignments"],
  );
}

export async function updateAssignmentAction(
  id: string,
  input: Partial<AssignmentInput>,
): Promise<ActionState> {
  return run(
    async () => {
      await updateAssignment(id, {
        title: input.title,
        description: input.description,
        instructions: input.instructions,
        classId: input.classId,
        subjectId: input.subjectId,
        courseId: input.courseId,
        dueDate: input.dueDate,
        maxScore: input.maxScore,
        attachmentUrl: input.attachmentUrl,
      });
    },
    [`/teacher/assignments/${id}`, "/teacher/assignments"],
  );
}

export async function setAssignmentStatusAction(
  id: string,
  status: ContentStatus,
): Promise<ActionState> {
  return run(
    async () => {
      await setAssignmentStatus(id, status);
    },
    [`/teacher/assignments/${id}`, "/teacher/assignments"],
  );
}

export async function deleteAssignmentAction(id: string): Promise<ActionState> {
  return run(
    async () => {
      await deleteAssignment(id);
    },
    ["/teacher/assignments"],
  );
}

export async function gradeSubmissionAction(
  submissionId: string,
  assignmentId: string,
  input: { score: number; feedback?: string | null },
): Promise<ActionState> {
  return run(
    async () => {
      await gradeSubmission(submissionId, input);
    },
    [`/teacher/assignments/${assignmentId}`],
  );
}

// ---------------------------------------------------------------------------
// Exam series
// ---------------------------------------------------------------------------

type ExamSeriesInput = {
  title: string;
  examType?: "common_entrance" | "waec" | "neco" | "jamb" | "school";
  year?: string | null;
  description?: string | null;
  subjectId?: string | null;
  classId?: string | null;
  status?: ContentStatus;
  durationMinutes?: number | null;
  shuffleQuestions?: boolean;
};

export async function createExamSeriesAction(input: ExamSeriesInput): Promise<ActionState> {
  return run(
    async () => {
      const id = await createExamSeries({
        title: input.title,
        examType: input.examType ?? "school",
        year: input.year,
        description: input.description,
        subjectId: input.subjectId,
        classId: input.classId,
        status: input.status === "published" ? "published" : "draft",
        durationMinutes: input.durationMinutes,
        shuffleQuestions: input.shuffleQuestions ?? false,
      });
      return id;
    },
    ["/teacher/exam-series"],
  );
}

export async function updateExamSeriesAction(
  id: string,
  input: Partial<ExamSeriesInput>,
): Promise<ActionState> {
  return run(
    async () => {
      await updateExamSeries(id, {
        title: input.title,
        examType: input.examType,
        year: input.year,
        description: input.description,
        subjectId: input.subjectId,
        classId: input.classId,
        durationMinutes: input.durationMinutes,
        shuffleQuestions: input.shuffleQuestions,
      });
    },
    [`/teacher/exam-series/${id}`, "/teacher/exam-series"],
  );
}

export async function setExamSeriesStatusAction(
  id: string,
  status: ContentStatus,
): Promise<ActionState> {
  return run(
    async () => {
      await setExamSeriesStatus(id, status);
    },
    [`/teacher/exam-series/${id}`, "/teacher/exam-series"],
  );
}

export async function deleteExamSeriesAction(id: string): Promise<ActionState> {
  return run(
    async () => {
      await deleteExamSeries(id);
    },
    ["/teacher/exam-series"],
  );
}

// ---------------------------------------------------------------------------
// Series questions
// ---------------------------------------------------------------------------

type SeriesQuestionInput = {
  questionText: string;
  questionType?: "multiple_choice" | "true_false" | "multiple_answer" | "essay";
  answerGuide?: string | null;
  topic?: string | null;
  difficulty?: "easy" | "medium" | "hard";
  marks?: number;
  explanation?: string | null;
  sectionId?: string | null;
  options?: { text: string; isCorrect?: boolean }[];
};

export async function addQuestionAction(
  seriesId: string,
  input: SeriesQuestionInput,
): Promise<ActionState> {
  return run(
    async () => {
      const id = await addQuestion(seriesId, {
        questionText: input.questionText,
        questionType: input.questionType ?? "multiple_choice",
        answerGuide: input.answerGuide ?? null,
        topic: input.topic,
        difficulty: input.difficulty ?? "medium",
        marks: input.marks ?? 1,
        explanation: input.explanation,
        sectionId: input.sectionId,
        options: (input.options ?? []).map((o) => ({
          text: o.text,
          isCorrect: o.isCorrect ?? false,
        })),
      });
      return id;
    },
    [`/teacher/exam-series/${seriesId}`],
  );
}

export async function updateQuestionAction(
  id: string,
  seriesId: string,
  input: SeriesQuestionInput,
): Promise<ActionState> {
  return run(
    async () => {
      await updateQuestion(id, {
        questionText: input.questionText,
        questionType: input.questionType ?? "multiple_choice",
        answerGuide: input.answerGuide ?? null,
        topic: input.topic,
        difficulty: input.difficulty ?? "medium",
        marks: input.marks ?? 1,
        explanation: input.explanation,
        sectionId: input.sectionId,
        options: (input.options ?? []).map((o) => ({
          text: o.text,
          isCorrect: o.isCorrect ?? false,
        })),
      });
    },
    [`/teacher/exam-series/${seriesId}`],
  );
}

export async function deleteQuestionAction(
  id: string,
  seriesId: string,
): Promise<ActionState> {
  return run(
    async () => {
      await deleteQuestion(id);
    },
    [`/teacher/exam-series/${seriesId}`],
  );
}

export async function saveEssayMarksAction(
  seriesId: string,
  attemptId: string,
  marks: { answerId: string; marksAwarded: number }[],
): Promise<ActionState> {
  return run(
    async () => {
      await saveEssayMarks(attemptId, marks);
    },
    [
      `/teacher/exam-series/${seriesId}/marking`,
      `/teacher/exam-series/${seriesId}/marking/${attemptId}`,
    ],
  );
}

// ---------------------------------------------------------------------------
// Series sections (CBT papers)
// ---------------------------------------------------------------------------

export async function createSectionAction(
  seriesId: string,
  input: { title: string; instructions?: string | null },
): Promise<ActionState> {
  return run(
    async () => {
      const id = await createSection(seriesId, {
        title: input.title,
        instructions: input.instructions,
      });
      return id;
    },
    [`/teacher/exam-series/${seriesId}`],
  );
}

export async function updateSectionAction(
  id: string,
  seriesId: string,
  input: { title?: string; instructions?: string | null; position?: number },
): Promise<ActionState> {
  return run(
    async () => {
      await updateSection(id, seriesId, input);
    },
    [`/teacher/exam-series/${seriesId}`],
  );
}

export async function deleteSectionAction(id: string, seriesId: string): Promise<ActionState> {
  return run(
    async () => {
      await deleteSection(id, seriesId);
    },
    [`/teacher/exam-series/${seriesId}`],
  );
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export async function saveAttendanceAction(
  classId: string,
  date: string,
  entries: { studentId: string; status: string }[],
): Promise<ActionState> {
  return run(
    async () => {
      await saveClassRegister(classId, date, entries);
    },
    ["/teacher/attendance"],
  );
}

// ---------------------------------------------------------------------------
// Question bank
// ---------------------------------------------------------------------------

type BankQuestionInput = {
  questionText: string;
  questionType?: "multiple_choice" | "true_false" | "multiple_answer" | "essay";
  answerGuide?: string | null;
  topic?: string | null;
  difficulty?: "easy" | "medium" | "hard";
  marks?: number;
  explanation?: string | null;
  options?: { text: string; isCorrect?: boolean }[];
};

export async function createQuestionBankAction(input: {
  name: string;
  description?: string | null;
  subjectId?: string | null;
  classId?: string | null;
}): Promise<ActionState> {
  return run(
    async () => {
      const id = await createQuestionBank({
        name: input.name,
        description: input.description,
        subjectId: input.subjectId,
        classId: input.classId,
      });
      return id;
    },
    ["/teacher/question-bank"],
  );
}

export async function deleteQuestionBankAction(id: string): Promise<ActionState> {
  return run(
    async () => {
      await deleteQuestionBank(id);
    },
    ["/teacher/question-bank"],
  );
}

export async function addBankQuestionAction(
  bankId: string,
  input: BankQuestionInput,
): Promise<ActionState> {
  return run(
    async () => {
      const id = await addBankQuestion(bankId, {
        questionText: input.questionText,
        questionType: input.questionType ?? "multiple_choice",
        answerGuide: input.answerGuide ?? null,
        topic: input.topic,
        difficulty: input.difficulty ?? "medium",
        marks: input.marks ?? 1,
        explanation: input.explanation,
        sectionId: null,
        options: (input.options ?? []).map((o) => ({
          text: o.text,
          isCorrect: o.isCorrect ?? false,
        })),
      });
      return id;
    },
    [`/teacher/question-bank/${bankId}`],
  );
}

export async function deleteBankQuestionAction(
  id: string,
  bankId: string,
): Promise<ActionState> {
  return run(
    async () => {
      await deleteBankQuestion(id);
    },
    [`/teacher/question-bank/${bankId}`],
  );
}
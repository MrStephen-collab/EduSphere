"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudent, setLessonCompletion } from "@/services/learning";
import { saveSubmissionDraft, submitAssignment } from "@/services/assignments";
import {
  reportPracticeSecurity,
  submitPracticeAttempt,
  type PracticeResult,
  type PracticeSecurityInput,
} from "@/services/exam";
import { sendExamResultEmail } from "@/email/hooks";

export type StudentActionState =
  | { ok: true }
  | { ok: false; error: string };

export type SubmitPracticeState =
  | { ok: true; result: PracticeResult }
  | { ok: false; error: string };

export async function completeLessonAction(input: {
  courseId: string;
  lessonId: string;
  completed: boolean;
}): Promise<StudentActionState> {
  try {
    const { schoolId, studentId } = await requireStudent();
    await setLessonCompletion(schoolId, studentId, input.lessonId, input.completed);
    revalidatePath(`/student/courses/${input.courseId}`);
    revalidatePath(`/student/courses/${input.courseId}/lessons/${input.lessonId}`);
    revalidatePath("/student/courses");
    revalidatePath("/student");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Something went wrong. Please try again.",
    };
  }
}

export async function continueFromLessonAction(input: {
  courseId: string;
  lessonId: string;
}): Promise<void> {
  await completeLessonAction({ ...input, completed: false });
  redirect(`/student/courses/${input.courseId}/lessons/${input.lessonId}`);
}

type SubmissionInput = {
  submissionText?: string | null;
  attachmentUrl?: string | null;
};

export async function saveSubmissionAction(
  assignmentId: string,
  input: SubmissionInput,
): Promise<StudentActionState> {
  try {
    const { schoolId, studentId } = await requireStudent();
    await saveSubmissionDraft(schoolId, studentId, assignmentId, input);
    revalidatePath(`/student/assignments/${assignmentId}`);
    revalidatePath("/student/assignments");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Something went wrong. Please try again.",
    };
  }
}

export async function submitAssignmentAction(
  assignmentId: string,
  input: SubmissionInput,
): Promise<StudentActionState> {
  try {
    const { schoolId, studentId } = await requireStudent();
    await submitAssignment(schoolId, studentId, assignmentId, input);
    revalidatePath(`/student/assignments/${assignmentId}`);
    revalidatePath("/student/assignments");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Something went wrong. Please try again.",
    };
  }
}

export async function submitPracticeAction(
  attemptId: string,
  answers: { questionId: string; optionId?: string | null; answerText?: string | null }[],
  security?: PracticeSecurityInput,
): Promise<SubmitPracticeState> {
  try {
    const { schoolId, studentId } = await requireStudent();
    const result = await submitPracticeAttempt(attemptId, answers, security);
    await sendExamResultEmail({
      schoolId,
      studentId,
      seriesId: result.seriesId,
      score: result.score,
      totalMarks: result.totalMarks,
    });
    revalidatePath(`/student/exam-series/${result.seriesId}`);
    revalidatePath("/student/exam-series");
    return { ok: true, result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Something went wrong. Please try again.",
    };
  }
}

/**
 * Best-effort push of the exam integrity trail while the paper is still open,
 * so a crash or a lost connection still leaves evidence. The final payload
 * travels with submitPracticeAction; failures here never interrupt the paper.
 */
export async function reportPracticeSecurityAction(
  attemptId: string,
  security: PracticeSecurityInput,
): Promise<void> {
  try {
    await reportPracticeSecurity(attemptId, security);
  } catch {
    // Reporting is a courtesy, never a reason to block a candidate.
  }
}
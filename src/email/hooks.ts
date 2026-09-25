import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { resolveAnnouncementRecipients } from "@/services/notifications";
import { examTypeLabels } from "@/lib/exam-labels";
import { sendEmail, sendEmails, type EmailRecipient } from "./mailer";
import {
  assignmentCreatedEmail,
  assignmentGradedEmail,
  examReminderEmail,
  examResultEmail,
  schoolAnnouncementEmail,
  subscriptionConfirmationEmail,
  welcomeEmail,
  type EmailMessage,
} from "./templates";

const MAX_EMAIL_RECIPIENTS = 150;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function percentage(score: number | null, total: number | null | undefined): number {
  if (!total) return 0;
  return Math.round(((score ?? 0) / total) * 100);
}

function moneyLabel(minorUnits: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(minorUnits / 100);
}

const adminClient = () => createAdminClient();

async function schoolNameOf(schoolId: string): Promise<string> {
  const { data } = await adminClient()
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();
  return (data as { name?: string } | null)?.name ?? "";
}

async function profileRecipients(
  userIds: string[],
): Promise<EmailRecipient[]> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const { data } = await adminClient()
    .from("profiles")
    .select("id, email, full_name")
    .in("id", unique);
  const rows = (data ?? []) as { id: string; email: string | null; full_name: string | null }[];
  return rows
    .filter((r) => !!r.email)
    .map((r) => ({ userId: r.id, email: r.email as string, name: r.full_name }));
}

async function sendMany(
  recipients: EmailRecipient[],
  builder: (recipient: EmailRecipient) => EmailMessage,
): Promise<void> {
  const capped = recipients.slice(0, MAX_EMAIL_RECIPIENTS);
  const results = await sendEmails(capped, builder);
  const failed = results.filter((r) => !r.ok).length;
  if (failed > 0 || recipients.length > capped.length) {
    console.info(
      `[email] batch: ${capped.length} attempted, ${failed} failed, ${recipients.length - capped.length} skipped (over cap)`,
    );
  }
}

// ---------------------------------------------------------------------------
// Welcome (§77)
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(input: {
  ownerUserId: string;
  schoolName: string;
}): Promise<void> {
  try {
    const [recipient] = await profileRecipients([input.ownerUserId]);
    if (!recipient) return;
    await sendEmail(recipient, welcomeEmail({
      name: recipient.name ?? recipient.email,
      schoolName: input.schoolName,
      loginUrl: `${appUrl()}/auth/login`,
    }));
  } catch (error) {
    console.error("[email] welcome hook failed", error);
  }
}

// ---------------------------------------------------------------------------
// Assignment created (§77)
// ---------------------------------------------------------------------------

export async function sendAssignmentCreatedEmails(input: {
  schoolId: string;
  assignmentId: string;
  classId: string | null;
  subjectId: string | undefined;
  title: string;
  dueDate: string | null;
  maxScore: number;
}): Promise<void> {
  try {
    const admin = adminClient();
    const schoolName = await schoolNameOf(input.schoolId);

    const subjectName = input.subjectId
      ? (
          await admin
            .from("subjects")
            .select("name")
            .eq("id", input.subjectId)
            .eq("school_id", input.schoolId)
            .maybeSingle()
        ).data?.name ?? null
      : null;

    const studentsRes = input.classId
      ? await admin
          .from("students")
          .select("user_id, display_name")
          .eq("school_id", input.schoolId)
          .eq("class_id", input.classId)
          .not("user_id", "is", null)
      : await admin
          .from("students")
          .select("user_id, display_name")
          .eq("school_id", input.schoolId)
          .not("user_id", "is", null);

    const students = (studentsRes.data ?? []) as {
      user_id: string;
      display_name: string | null;
    }[];
    if (students.length === 0) return;

    const recipients = await profileRecipients(students.map((s) => s.user_id));
    if (recipients.length === 0) return;

    const nameById = new Map(
      students.map((s) => [s.user_id, s.display_name]),
    );

    await sendMany(recipients, (recipient) => {
      const studentName =
        (recipient.userId ? nameById.get(recipient.userId) : null) ??
        recipient.name ??
        recipient.email;
      return assignmentCreatedEmail({
        studentName,
        schoolName,
        assignmentTitle: input.title,
        subject: subjectName,
        dueDate: input.dueDate ? formatDate(input.dueDate) : null,
        maxScore: input.maxScore,
        url: `${appUrl()}/student/assignments/${input.assignmentId}`,
      });
    });
  } catch (error) {
    console.error("[email] assignment-created hook failed", error);
  }
}

// ---------------------------------------------------------------------------
// Assignment graded (§77)
// ---------------------------------------------------------------------------

export async function sendAssignmentGradedEmail(input: {
  schoolId: string;
  submissionId: string;
}): Promise<void> {
  try {
    const admin = adminClient();
    const { data: submission } = await admin
      .from("assignment_submissions")
      .select("student_id, score, feedback, assignment_id")
      .eq("id", input.submissionId)
      .eq("school_id", input.schoolId)
      .maybeSingle();
    if (!submission?.student_id || !submission.assignment_id) return;

    const [studentRes, assignmentRes, subjectRes] = await Promise.all([
      admin
        .from("students")
        .select("user_id")
        .eq("id", submission.student_id)
        .eq("school_id", input.schoolId)
        .maybeSingle(),
      admin
        .from("assignments")
        .select("title, max_score, subject_id")
        .eq("id", submission.assignment_id)
        .eq("school_id", input.schoolId)
        .maybeSingle(),
      admin
        .from("subjects")
        .select("name, id")
        .eq("school_id", input.schoolId),
    ]);

    const assignment = assignmentRes?.data as
      | { title: string; max_score: number; subject_id: string | null }
      | null
      | undefined;
    if (!studentRes?.data || !assignment) return;

    const subjectName = assignment.subject_id
      ? ((subjectRes.data ?? []) as { id: string; name: string }[])
          .find((s) => s.id === assignment.subject_id)?.name ?? null
      : null;

    const [recipient] = await profileRecipients([studentRes.data.user_id]);
    if (!recipient) return;

    await sendEmail(recipient, assignmentGradedEmail({
      studentName: recipient.name ?? recipient.email,
      assignmentTitle: assignment.title,
      subject: subjectName,
      score: submission.score ?? 0,
      maxScore: assignment.max_score,
      percentage: percentage(submission.score, assignment.max_score),
      feedback: submission.feedback,
      url: `${appUrl()}/student/assignments/${submission.assignment_id}`,
    }));
  } catch (error) {
    console.error("[email] assignment-graded hook failed", error);
  }
}

// ---------------------------------------------------------------------------
// Exam reminder (§77) — delivery is driven by a scheduler. This hook performs
// the lookup + send once `startsAt` is known (no cron exists yet in the app).
// ---------------------------------------------------------------------------

export async function sendExamReminderEmails(input: {
  schoolId: string;
  seriesId: string;
  startsAt: string | null;
  durationMinutes: number | null;
}): Promise<void> {
  try {
    const admin = adminClient();
    const schoolName = await schoolNameOf(input.schoolId);
    const { data: series } = await admin
      .from("exam_series")
      .select("title, exam_type, class_id")
      .eq("id", input.seriesId)
      .eq("school_id", input.schoolId)
      .maybeSingle();
    if (!series) return;
    const seriesRow = series as {
      title: string;
      exam_type: string;
      class_id: string | null;
    };

    const studentsRes = seriesRow.class_id
      ? await admin
          .from("students")
          .select("user_id")
          .eq("school_id", input.schoolId)
          .eq("class_id", seriesRow.class_id)
          .not("user_id", "is", null)
      : await admin
          .from("students")
          .select("user_id")
          .eq("school_id", input.schoolId)
          .not("user_id", "is", null);
    const students = (studentsRes.data ?? []) as { user_id: string }[];
    if (students.length === 0) return;

    const recipients = await profileRecipients(students.map((s) => s.user_id));
    if (recipients.length === 0) return;

    const examTypeLabel =
      examTypeLabels[seriesRow.exam_type as keyof typeof examTypeLabels] ?? null;

    await sendMany(recipients, (recipient) =>
      examReminderEmail({
        studentName: recipient.name ?? recipient.email,
        schoolName,
        seriesTitle: seriesRow.title,
        examTypeLabel,
        startsAt: input.startsAt
          ? formatDate(input.startsAt, {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : null,
        durationMinutes: input.durationMinutes,
        url: `${appUrl()}/student/exam-series/${input.seriesId}`,
      }),
    );
  } catch (error) {
    console.error("[email] exam-reminder hook failed", error);
  }
}

// ---------------------------------------------------------------------------
// Exam result (§77)
// ---------------------------------------------------------------------------

export async function sendExamResultEmail(input: {
  schoolId: string;
  studentId: string;
  seriesId: string;
  score: number;
  totalMarks: number;
}): Promise<void> {
  try {
    const admin = adminClient();
    const [schoolNamePromise, { data: student }, { data: series }] =
      await Promise.all([
        schoolNameOf(input.schoolId),
        admin
          .from("students")
          .select("user_id")
          .eq("id", input.studentId)
          .eq("school_id", input.schoolId)
          .maybeSingle(),
        admin
          .from("exam_series")
          .select("title")
          .eq("id", input.seriesId)
          .eq("school_id", input.schoolId)
          .maybeSingle(),
      ]);
    if (!student?.user_id || !series) return;
    const [recipient] = await profileRecipients([student.user_id]);
    if (!recipient) return;

    await sendEmail(recipient, examResultEmail({
      studentName: recipient.name ?? recipient.email,
      seriesTitle: (series as { title: string }).title,
      schoolName: schoolNamePromise,
      score: input.score,
      totalMarks: input.totalMarks,
      percentage: percentage(input.score, input.totalMarks),
      url: `${appUrl()}/student/exam-series/${input.seriesId}/practice`,
    }));
  } catch (error) {
    console.error("[email] exam-result hook failed", error);
  }
}

// ---------------------------------------------------------------------------
// School announcement (§77)
// ---------------------------------------------------------------------------

function homePathForRole(role: string | null | undefined): string {
  const roleUpper = (role ?? "").toUpperCase();
  if (roleUpper === "STUDENT") return "/student";
  if (roleUpper === "TEACHER") return "/teacher";
  if (roleUpper === "PARENT") return "/parent";
  if (roleUpper === "SUPER_ADMIN") return "/platform";
  return "/school/announcements";
}

export async function sendAnnouncementEmails(input: {
  schoolId: string;
  title: string;
  message: string;
  targetType: "school" | "students" | "teachers" | "parents" | "class";
  classId: string | null;
}): Promise<void> {
  try {
    const schoolName = await schoolNameOf(input.schoolId);
    const resolved = await resolveAnnouncementRecipients({
      schoolId: input.schoolId,
      targetType: input.targetType,
      classId: input.classId,
    });
    if (resolved.length === 0) return;

    const recipients = await profileRecipients(resolved.map((r) => r.user_id));
    if (recipients.length === 0) return;

    const roleByUserId = new Map(
      resolved.map((r) => [r.user_id, r.role ?? null]),
    );

    await sendMany(recipients, (recipient) => {
      const role = recipient.userId ? roleByUserId.get(recipient.userId) : null;
      return schoolAnnouncementEmail({
        name: recipient.name ?? recipient.email,
        schoolName,
        title: input.title,
        message: input.message,
        url: `${appUrl()}${homePathForRole(role)}`,
      });
    });
  } catch (error) {
    console.error("[email] announcement hook failed", error);
  }
}

// ---------------------------------------------------------------------------
// Subscription confirmation (§77)
// ---------------------------------------------------------------------------

export async function sendSubscriptionConfirmedEmail(input: {
  schoolId: string;
  planName: string;
  amountMinor: number;
  interval: "monthly" | "annual";
  periodEnd: string;
}): Promise<void> {
  try {
    const schoolName = await schoolNameOf(input.schoolId);
    const { data: admins } = await adminClient()
      .from("user_roles")
      .select("user_id")
      .eq("school_id", input.schoolId)
      .eq("role", "SCHOOL_ADMIN");
    const recipients = await profileRecipients(
      (admins ?? []).map((r) => (r as { user_id: string }).user_id),
    );
    if (recipients.length === 0) return;

    await sendMany(recipients, (recipient) =>
      subscriptionConfirmationEmail({
        name: recipient.name ?? recipient.email,
        schoolName,
        planName: input.planName,
        periodLabel: input.interval === "annual" ? "annual billing" : "monthly billing",
        amountLabel: moneyLabel(input.amountMinor),
        periodEnd: formatDate(input.periodEnd),
        url: `${appUrl()}/school/billing`,
      }),
    );
  } catch (error) {
    console.error("[email] subscription hook failed", error);
  }
}
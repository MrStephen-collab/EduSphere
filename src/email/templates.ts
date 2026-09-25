export type EmailMessage = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BRAND = "EduSphere";

function layout(opts: {
  preheader: string;
  title: string;
  body: string;
  cta?: { label: string; href: string };
}): string {
  const { preheader, title, body, cta } = opts;
  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td style="border-radius:10px;background:#2563eb;"><a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(cta.label)}</a></td></tr></table>`
    : "";

  return `<div style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#0a0a0a;padding:20px 28px;">
          <span style="font-size:18px;font-weight:700;color:#ffffff;">${BRAND}</span>
        </td></tr>
        <tr><td style="padding:28px;color:#0f172a;">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#0f172a;">${escapeHtml(title)}</h1>
          <div style="font-size:14px;line-height:1.6;color:#334155;">${body}</div>
          ${ctaHtml}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5;">
          You received this email because you use ${BRAND}.<br/>
          If this wasn't you, you can safely ignore this message.
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

function body(content: string): string {
  return content
    .split("\n")
    .map((line) => `<p style="margin:0 0 12px;">${escapeHtml(line)}</p>`)
    .join("");
}

// ---------------------------------------------------------------------------
// §77 templates
// ---------------------------------------------------------------------------

export function welcomeEmail(input: {
  name: string;
  schoolName: string;
  loginUrl: string;
}): EmailMessage {
  return {
    subject: `Welcome to ${BRAND}, ${input.name}`,
    html: layout({
      preheader: `Your digital classroom, ${input.schoolName}, is set up.`,
      title: `Welcome to ${BRAND}, ${input.name}`,
      body: body(
        `Your school ${input.schoolName} is now part of ${BRAND}, the digital classroom where teachers teach, students learn, assessments happen and parents stay connected.`,
      ),
      cta: { label: "Sign in to your school", href: input.loginUrl },
    }),
    text: `Welcome to ${BRAND}, ${input.name}.\n\nYour school ${input.schoolName} is ready. Sign in at ${input.loginUrl} to get started.`,
  };
}

export function passwordResetEmail(input: {
  name: string;
  resetUrl: string;
}): EmailMessage {
  return {
    subject: `Reset your ${BRAND} password`,
    html: layout({
      preheader: "Reset your EduSphere password.",
      title: "Reset your password",
      body: body(
        `Hi ${input.name},\n\nWe received a request to reset your ${BRAND} password. This link is only valid for a short time.\n\nIf you didn't request a password reset, you can ignore this email.`,
      ),
      cta: { label: "Reset password", href: input.resetUrl },
    }),
    text: `Hi ${input.name},\n\nReset your ${BRAND} password here: ${input.resetUrl}\n\nIf you didn't request this, ignore this email.`,
  };
}

export function assignmentCreatedEmail(input: {
  studentName: string;
  schoolName: string;
  assignmentTitle: string;
  subject: string | null;
  dueDate: string | null;
  maxScore: number;
  url: string;
}): EmailMessage {
  const subject = input.subject ? ` (${input.subject})` : "";
  return {
    subject: `New assignment: ${input.assignmentTitle}`,
    html: layout({
      preheader: `A new assignment — ${input.assignmentTitle} — has been given to your class.`,
      title: `New assignment${subject}`,
      body: body(
        `Hi ${input.studentName},\n\n${input.schoolName} posted a new assignment for you: "${input.assignmentTitle}".` +
          (input.dueDate ? `\nDue: ${input.dueDate}` : "") +
          `\nMaximum score: ${input.maxScore}.`,
      ),
      cta: { label: "Open assignment", href: input.url },
    }),
    text: `Hi ${input.studentName},\n\n${input.schoolName} posted a new assignment: "${input.assignmentTitle}".\nDue: ${input.dueDate ?? "to be announced"}.\nOpen it here: ${input.url}`,
  };
}

export function assignmentGradedEmail(input: {
  studentName: string;
  assignmentTitle: string;
  subject: string | null;
  score: number;
  maxScore: number;
  percentage: number;
  feedback: string | null;
  url: string;
}): EmailMessage {
  return {
    subject: `Your assignment "${input.assignmentTitle}" has been graded`,
    html: layout({
      preheader: `You scored ${input.score}/${input.maxScore} (${input.percentage}%).`,
      title: `Your assignment has been graded`,
      body: body(
        `Hi ${input.studentName},\n\nYour assignment "${input.assignmentTitle}"${input.subject ? ` (${input.subject})` : ""} has been graded.\n\nScore: ${input.score} / ${input.maxScore} (${input.percentage}%).` +
          (input.feedback ? `\n\nTeacher's feedback: ${input.feedback}` : ""),
      ),
      cta: { label: "View result", href: input.url },
    }),
    text: `Hi ${input.studentName},\n\nYour assignment "${input.assignmentTitle}" was graded: ${input.score}/${input.maxScore} (${input.percentage}%).\nView it here: ${input.url}`,
  };
}

export function examReminderEmail(input: {
  studentName: string;
  schoolName: string;
  seriesTitle: string;
  examTypeLabel: string | null;
  startsAt: string | null;
  durationMinutes: number | null;
  url: string;
}): EmailMessage {
  return {
    subject: `Reminder: ${input.seriesTitle}`,
    html: layout({
      preheader: `${input.seriesTitle} is coming up. Don't forget to practise.`,
      title: `Exam reminder`,
      body: body(
        `Hi ${input.studentName},\n\n${input.schoolName} wants to remind you about "${input.seriesTitle}"${input.examTypeLabel ? ` (${input.examTypeLabel})` : ""}.` +
          (input.startsAt ? `\nScheduled: ${input.startsAt}` : "") +
          (input.durationMinutes ? `\nDuration: ${input.durationMinutes} minutes.` : ""),
      ),
      cta: { label: "Open exam series", href: input.url },
    }),
    text: `Hi ${input.studentName},\n\nReminder: "${input.seriesTitle}"${input.startsAt ? ` is scheduled for ${input.startsAt}.` : " is coming up."}\nOpen it here: ${input.url}`,
  };
}

export function examResultEmail(input: {
  studentName: string;
  seriesTitle: string;
  schoolName: string;
  score: number;
  totalMarks: number;
  percentage: number;
  url: string;
}): EmailMessage {
  return {
    subject: `Your result for ${input.seriesTitle}`,
    html: layout({
      preheader: `You scored ${input.score}/${input.totalMarks} (${input.percentage}%) in ${input.seriesTitle}.`,
      title: `Your exam result`,
      body: body(
        `Hi ${input.studentName},\n\nYour attempt at "${input.seriesTitle}" has been marked.\n\nScore: ${input.score} / ${input.totalMarks} (${input.percentage}%).`,
      ),
      cta: { label: "See your result", href: input.url },
    }),
    text: `Hi ${input.studentName},\n\nYour result for "${input.seriesTitle}" is ${input.score}/${input.totalMarks} (${input.percentage}%).\nView it here: ${input.url}`,
  };
}

export function schoolAnnouncementEmail(input: {
  name: string;
  schoolName: string;
  title: string;
  message: string;
  url: string;
}): EmailMessage {
  return {
    subject: `${input.schoolName}: ${input.title}`,
    html: layout({
      preheader: `${input.schoolName} announced: ${input.title}`,
      title: `${input.schoolName}`,
      body: `<p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#2563eb;text-transform:uppercase;letter-spacing:0.02em;">${escapeHtml(input.title)}</p>` +
        `<p style="margin:0;">${escapeHtml(input.message).replace(/\n/g, "<br/>")}</p>`,
      cta: { label: "View announcement", href: input.url },
    }),
    text: `${input.schoolName} — ${input.title}\n\n${input.message}\n\nView it here: ${input.url}`,
  };
}

export function subscriptionConfirmationEmail(input: {
  name: string;
  schoolName: string;
  planName: string;
  periodLabel: string;
  amountLabel: string;
  periodEnd: string | null;
  url: string;
}): EmailMessage {
  return {
    subject: `Your ${BRAND} subscription is active`,
    html: layout({
      preheader: `${input.schoolName} subscribed to the ${input.planName} plan.`,
      title: `Subscription confirmed`,
      body: body(
        `Hi ${input.name},\n\nThanks for subscribing ${input.schoolName} to the ${input.planName} plan (${input.periodLabel}, ${input.amountLabel}).` +
          (input.periodEnd ? `\nThe current period ends on ${input.periodEnd}.` : "") +
          `\n\nYou can manage your subscription from the Billing page.`,
      ),
      cta: { label: "Open billing", href: input.url },
    }),
    text: `Hi ${input.name},\n\n${input.schoolName} is now on the ${input.planName} plan (${input.periodLabel}, ${input.amountLabel}).\nManage it here: ${input.url}`,
  };
}
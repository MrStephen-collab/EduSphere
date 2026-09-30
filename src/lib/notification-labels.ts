import type { NotificationType } from "@/types/database";

export const notificationTypeLabels: Record<NotificationType, string> = {
  assignment_due: "Assignment due",
  assignment_graded: "Assignment graded",
  exam_upcoming: "Exam upcoming",
  exam_result: "Exam result",
  new_lesson: "New lesson",
  announcement: "Announcement",
  fee_invoice_issued: "Fee invoice",
  fee_payment_submitted: "Payment submitted",
  fee_payment_approved: "Payment approved",
  fee_payment_rejected: "Payment rejected",
  system: "Notification",
};

export function notificationTypeLabel(type: NotificationType): string {
  return notificationTypeLabels[type] ?? "Notification";
}
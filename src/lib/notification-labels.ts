import type { NotificationType } from "@/types/database";

export const notificationTypeLabels: Record<NotificationType, string> = {
  assignment_due: "Assignment due",
  assignment_graded: "Assignment graded",
  exam_upcoming: "Exam upcoming",
  exam_result: "Exam result",
  new_lesson: "New lesson",
  announcement: "Announcement",
  system: "Notification",
};

export function notificationTypeLabel(type: NotificationType): string {
  return notificationTypeLabels[type] ?? "Notification";
}
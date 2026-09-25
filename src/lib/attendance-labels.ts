import type { AttendanceStatus } from "@/types/database";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "present",
  "late",
  "absent",
  "excused",
];

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};
import type { AnnouncementTarget } from "@/types/database";

export const ANNOUNCEMENT_TARGETS: AnnouncementTarget[] = [
  "school",
  "class",
  "students",
  "teachers",
  "parents",
];

export const announcementTargetLabels: Record<AnnouncementTarget, string> = {
  school: "Entire school",
  class: "A class",
  students: "All students",
  teachers: "All teachers",
  parents: "All parents",
};
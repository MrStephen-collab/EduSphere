import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export type StudentProgressCourse = {
  courseId: string | null;
  courseName: string | null;
  overallPercentage: number | null;
  lessonsCompleted: number;
  assignmentsCompleted: number;
  testsCompleted: number;
  startedLessons: number;
  finishedLessons: number;
};

export type StudentProgressOverview = {
  overallPercentage: number | null;
  lessonsCompleted: number;
  assignmentsCompleted: number;
  testsCompleted: number;
  learningStreak: number;
  lastActivityAt: string | null;
  courses: StudentProgressCourse[];
};

export async function getStudentProgress(
  schoolId: string,
  studentId: string,
): Promise<StudentProgressOverview> {
  const supabase = await createSupabaseServerClient();

  const [progressRes, lessonsRes] = await Promise.all([
    supabase
      .from("student_progress")
      .select(
        "course_id, overall_percentage, lessons_completed, assignments_completed, tests_completed, learning_streak, last_activity_at, courses(name)",
      )
      .eq("school_id", schoolId)
      .eq("student_id", studentId),
    supabase
      .from("lesson_progress")
      .select("progress_percentage, completed_at, lessons(course_id)")
      .eq("school_id", schoolId)
      .eq("student_id", studentId),
  ]);

  const progressRows = (progressRes.data ?? []) as Array<{
    course_id: string | null;
    overall_percentage: number | null;
    lessons_completed: number;
    assignments_completed: number;
    tests_completed: number;
    learning_streak: number;
    last_activity_at: string | null;
    courses: Array<{ name: string }>;
  }>;

  const lessonRows = (lessonsRes.data ?? []) as Array<{
    started_at: string | null;
    progress_percentage: number;
    completed_at: string | null;
    lessons: Array<{ course_id: string | null }>;
  }>;

  const courseNames = new Map<string, string>();
  const startedByCourse = new Map<string, number>();
  const completedByCourse = new Map<string, number>();
  const overallByCourse = new Map<string, number>();

  let totalCompleted = 0;
  let progressSum = 0;
  let progressCount = 0;

  for (const row of progressRows) {
    if (row.course_id) {
      courseNames.set(row.course_id, row.courses[0]?.name ?? "Course");
      if (row.overall_percentage != null) overallByCourse.set(row.course_id, row.overall_percentage);
    }
    if (row.overall_percentage != null) {
      progressSum += row.overall_percentage;
      progressCount += 1;
    }
  }

  for (const row of lessonRows) {
    const courseId = row.lessons[0]?.course_id ?? "";
    startedByCourse.set(courseId, (startedByCourse.get(courseId) ?? 0) + 1);
    if (row.completed_at || row.progress_percentage >= 100) {
      totalCompleted += 1;
      completedByCourse.set(courseId, (completedByCourse.get(courseId) ?? 0) + 1);
    }
  }

  const overall = progressRows.find((r) => r.course_id === null);
  const merged = new Map<string, StudentProgressCourse>();
  for (const row of progressRows) {
    if (!row.course_id) continue;
    merged.set(row.course_id, {
      courseId: row.course_id,
      courseName: courseNames.get(row.course_id) ?? null,
      overallPercentage: overallByCourse.get(row.course_id) ?? row.overall_percentage,
      lessonsCompleted: row.lessons_completed,
      assignmentsCompleted: row.assignments_completed,
      testsCompleted: row.tests_completed,
      startedLessons: startedByCourse.get(row.course_id) ?? 0,
      finishedLessons: completedByCourse.get(row.course_id) ?? 0,
    });
  }

  const courses = [...merged.values()].sort((a, b) =>
    (a.courseName ?? "").localeCompare(b.courseName ?? ""),
  );

  return {
    overallPercentage:
      overall?.overall_percentage ??
      (progressCount > 0 ? Math.round(progressSum / progressCount) : null),
    lessonsCompleted: totalCompleted,
    assignmentsCompleted: overall?.assignments_completed ?? 0,
    testsCompleted: overall?.tests_completed ?? 0,
    learningStreak: overall?.learning_streak ?? 0,
    lastActivityAt: overall?.last_activity_at ?? null,
    courses,
  };
}
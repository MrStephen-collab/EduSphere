import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import type {
  ContentStatus,
  Course,
  CourseModule,
  Lesson,
  LessonMaterial,
  LessonProgress,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const courseSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  subjectId: z.string().uuid("Choose a valid subject").optional().nullable(),
  classId: z.string().uuid("Choose a valid class").optional().nullable(),
  status: z.enum(["draft", "published"]).optional().default("draft"),
});

export const moduleSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(2, "Module title is required").max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  order: z.coerce.number().int().min(0).max(1000).optional().default(0),
});

export const lessonSchema = z.object({
  courseId: z.string().uuid(),
  moduleId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(2, "Lesson title is required").max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  content: z.string().max(50000).optional().nullable(),
  videoUrl: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(["draft", "published"]).optional().default("draft"),
});

export const materialSchema = z.object({
  lessonId: z.string().uuid(),
  title: z.string().trim().min(2, "Material title is required").max(160),
  fileType: z
    .enum(["pdf", "doc", "docx", "ppt", "pptx", "image", "audio", "video", "link", "text", "other"])
    .optional()
    .default("link"),
  fileUrl: z.string().trim().max(1000).optional().nullable(),
  isPublic: z.boolean().optional().default(false),
});

export { materialTypeLabels } from "@/lib/material-types";

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

export type CourseListItem = Course & {
  subjects: { name: string } | null;
  classes: { name: string } | null;
  teachers: { display_name: string | null } | null;
  course_modules?: CourseModule[] | null;
  lessons?: Lesson[] | null;
};

export type LessonWithMaterials = Lesson & {
  lesson_materials?: LessonMaterial[] | null;
};

// ---------------------------------------------------------------------------
// Teacher / admin content management
// ---------------------------------------------------------------------------

export async function listCourses(
  schoolId: string,
): Promise<CourseListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select(
      "*, subjects(name), classes(name), teachers(display_name), course_modules(id), lessons(id)",
    )
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CourseListItem[];
}

export async function getCourseDetail(
  schoolId: string,
  courseId: string,
): Promise<{
  course: Course & {
    subjects: { name: string } | null;
    classes: { name: string } | null;
    teachers: { display_name: string | null } | null;
  } | null;
  modules: (CourseModule & { lessons: LessonWithMaterials[] })[];
  unassignedLessons: LessonWithMaterials[];
}> {
  const supabase = await createSupabaseServerClient();

  const { data: course, error } = await supabase
    .from("courses")
    .select("*, subjects(name), classes(name), teachers(display_name)")
    .eq("id", courseId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!course) return { course: null, modules: [], unassignedLessons: [] };

  const [modulesRes, lessonsRes] = await Promise.all([
    supabase
      .from("course_modules")
      .select("*")
      .eq("course_id", courseId)
      .eq("school_id", schoolId)
      .order("order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("lessons")
      .select("*, lesson_materials(id)")
      .eq("course_id", courseId)
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  const modules = (modulesRes.data ?? []) as CourseModule[];
  const lessons = (lessonsRes.data ?? []) as LessonWithMaterials[];

  const grouped = modules.map((m) => ({
    ...m,
    lessons: lessons.filter((l) => l.module_id === m.id),
  }));

  return {
    course: course as Course & {
      subjects: { name: string } | null;
      classes: { name: string } | null;
      teachers: { display_name: string | null } | null;
    },
    modules: grouped,
    unassignedLessons: lessons.filter((l) => !l.module_id),
  };
}

export async function createCourse(input: z.infer<typeof courseSchema>): Promise<string> {
  const { schoolId, teacherId } = await requireContentEditor();
  const data = courseSchema.parse(input);
  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("courses")
    .insert({
      school_id: schoolId,
      subject_id: data.subjectId ?? null,
      class_id: data.classId ?? null,
      teacher_id: teacherId,
      title: data.title,
      description: data.description ?? null,
      status: data.status,
    })
    .select("id")
    .single();
  if (error) throw new Error("We couldn't create this course.");
  return row.id;
}

export async function updateCourse(
  id: string,
  input: Partial<z.infer<typeof courseSchema>> & { title?: string; description?: string | null; subjectId?: string | null; classId?: string | null },
): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const data = courseSchema.partial().parse(input);
  const admin = createAdminClient();

  const { error } = await admin
    .from("courses")
    .update({
      title: data.title,
      description: data.description ?? null,
      subject_id: data.subjectId ?? null,
      class_id: data.classId ?? null,
    })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't update this course.");
}

export async function setCourseStatus(id: string, status: ContentStatus): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  const { error } = await admin
    .from("courses")
    .update({ status })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't update this course.");
}

export async function deleteCourse(id: string): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  const { error } = await admin
    .from("courses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this course.");
}

export async function createModule(input: z.infer<typeof moduleSchema>): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const data = moduleSchema.parse(input);
  const admin = createAdminClient();

  const { data: maxRes } = await admin
    .from("course_modules")
    .select("order")
    .eq("course_id", data.courseId)
    .eq("school_id", schoolId)
    .order("order", { ascending: false })
    .limit(1);

  const nextOrder = data.order ?? ((maxRes?.[0]?.order ?? -1) + 1);

  const { error } = await admin
    .from("course_modules")
    .insert({
      school_id: schoolId,
      course_id: data.courseId,
      title: data.title,
      description: data.description ?? null,
      order: nextOrder,
    });
  if (error) throw new Error("We couldn't create this module.");
}

export async function updateModule(
  id: string,
  input: { title?: string; description?: string | null; order?: number },
): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const data = moduleSchema.partial().parse(input);
  const admin = createAdminClient();
  const { error } = await admin
    .from("course_modules")
    .update({
      title: data.title,
      description: data.description ?? null,
      order: data.order,
    })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't update this module.");
}

export async function deleteModule(id: string): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  const { error } = await admin
    .from("course_modules")
    .delete()
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this module.");
}

export async function createLesson(input: z.infer<typeof lessonSchema>): Promise<string> {
  const { schoolId, userId } = await requireContentEditor();
  const data = lessonSchema.parse(input);
  const admin = createAdminClient();

  const { data: row, error } = await admin
    .from("lessons")
    .insert({
      school_id: schoolId,
      course_id: data.courseId,
      module_id: data.moduleId ?? null,
      title: data.title,
      description: data.description ?? null,
      content: data.content ?? null,
      video_url: data.videoUrl ?? null,
      status: data.status,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error("We couldn't create this lesson.");
  return row.id;
}

export async function updateLesson(
  id: string,
  input: Partial<z.infer<typeof lessonSchema>> & {
    title?: string;
    description?: string | null;
    content?: string | null;
    videoUrl?: string | null;
    moduleId?: string | null;
  },
): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const data = lessonSchema.partial().parse(input);
  const admin = createAdminClient();

  const { error } = await admin
    .from("lessons")
    .update({
      title: data.title,
      description: data.description ?? null,
      content: data.content ?? null,
      video_url: data.videoUrl ?? null,
      module_id: data.moduleId ?? null,
    })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't update this lesson.");
}

export async function setLessonStatus(id: string, status: ContentStatus): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  const { error } = await admin
    .from("lessons")
    .update({ status })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't update this lesson.");
}

export async function deleteLesson(id: string): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  const { error } = await admin
    .from("lessons")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this lesson.");
}

export async function getLessonForEditor(
  schoolId: string,
  lessonId: string,
): Promise<{
  lesson: LessonWithMaterials | null;
  course: Course | null;
}> {
  const supabase = await createSupabaseServerClient();
  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("*, lesson_materials(*)")
    .eq("id", lessonId)
    .eq("school_id", schoolId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lesson) return { lesson: null, course: null };

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", lesson.course_id)
    .eq("school_id", schoolId)
    .maybeSingle();

  return {
    lesson: lesson as LessonWithMaterials,
    course: (course as Course) ?? null,
  };
}

export async function createMaterial(input: z.infer<typeof materialSchema>): Promise<void> {
  const { schoolId, userId } = await requireContentEditor();
  const data = materialSchema.parse(input);
  const admin = createAdminClient();

  const { error } = await admin.from("lesson_materials").insert({
    school_id: schoolId,
    lesson_id: data.lessonId,
    title: data.title,
    file_type: data.fileType,
    file_url: data.fileUrl ?? null,
    is_public: data.isPublic ?? false,
    created_by: userId,
  });
  if (error) throw new Error("We couldn't add this material.");
}

export async function deleteMaterial(id: string): Promise<void> {
  const { schoolId } = await requireContentEditor();
  const admin = createAdminClient();
  const { error } = await admin
    .from("lesson_materials")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("school_id", schoolId);
  if (error) throw new Error("We couldn't delete this material.");
}

// ---------------------------------------------------------------------------
// Student learning + progress
// ---------------------------------------------------------------------------

export type StudentContext = {
  schoolId: string;
  schoolName: string;
  studentId: string;
};

export async function requireStudent(): Promise<StudentContext> {
  const context = await getAuthContext();
  if (!context.user) redirect("/auth/login");

  const membership = context.memberships.find((m) => m.role === "STUDENT");
  if (!membership) redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", membership.school.id)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (!data) redirect("/dashboard");

  return {
    schoolId: membership.school.id,
    schoolName: membership.school.name,
    studentId: data.id,
  };
}

export type StudentCourseSummary = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  subject: string | null;
  className: string | null;
  lessonCount: number;
  completedLessons: number;
  overallPercentage: number;
};

export async function getStudentCourses(
  schoolId: string,
  studentId: string,
): Promise<StudentCourseSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  let query = supabase
    .from("courses")
    .select(
      "*, subjects(name), classes(name), lessons(id)",
    )
    .eq("school_id", schoolId)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (student?.class_id) {
    query = query.or(`class_id.eq.${student.class_id},class_id.is.null`);
  } else {
    query = query.is("class_id", null);
  }

  const { data: courses, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (courses ?? []) as (Course & {
    subjects: { name: string } | null;
    classes: { name: string } | null;
    lessons?: Lesson[] | null;
  })[];

  if (rows.length === 0) return [];

  const courseIds = rows.map((c) => c.id);
  const { data: progressRows } = await supabase
    .from("lesson_progress")
    .select("lesson_id, progress_percentage")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .in("lesson.course_id", courseIds)
    .order("updated_at", { ascending: false });

  const progressByLesson = new Map(
    (progressRows ?? []).map((p) => [p.lesson_id, p.progress_percentage]),
  );

  return rows.map((c) => {
    const lessons = c.lessons ?? [];
    const completed = lessons.filter(
      (l) => progressByLesson.get(l.id) === 100,
    ).length;
    const total = lessons.length;
    const overall = total ? Math.round((completed / total) * 100) : 0;
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      cover_url: c.cover_url,
      subject: c.subjects?.name ?? null,
      className: c.classes?.name ?? null,
      lessonCount: total,
      completedLessons: completed,
      overallPercentage: overall,
    };
  });
}

export type StudentCourseDetail = {
  course: Course | null;
  subject: string | null;
  className: string | null;
  teacherName: string | null;
  modules: (CourseModule & {
    lessons: (Lesson & { progress: LessonProgress | null })[];
  })[];
  unassignedLessons: (Lesson & { progress: LessonProgress | null })[];
  totalLessons: number;
  completedLessons: number;
  overallPercentage: number;
};

export async function getStudentCourseDetail(
  schoolId: string,
  studentId: string,
  courseId: string,
): Promise<StudentCourseDetail> {
  const supabase = await createSupabaseServerClient();

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("*, subjects(name), classes(name), teachers(display_name)")
    .eq("id", courseId)
    .eq("school_id", schoolId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (courseError) throw new Error(courseError.message);

  if (!course) {
    return {
      course: null,
      subject: null,
      className: null,
      teacherName: null,
      modules: [],
      unassignedLessons: [],
      totalLessons: 0,
      completedLessons: 0,
      overallPercentage: 0,
    };
  }

  const [modulesRes, lessonsRes, progressRes] = await Promise.all([
    supabase
      .from("course_modules")
      .select("*")
      .eq("course_id", courseId)
      .eq("school_id", schoolId)
      .order("order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("lessons")
      .select("*")
      .eq("course_id", courseId)
      .eq("school_id", schoolId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("lesson_progress")
      .select("*")
      .eq("student_id", studentId)
      .eq("school_id", schoolId),
  ]);

  const modules = (modulesRes.data ?? []) as CourseModule[];
  const lessons = (lessonsRes.data ?? []) as Lesson[];
  const progressByLesson = new Map(
    (progressRes.data ?? [] as LessonProgress[]).map((p) => [p.lesson_id, p]),
  );

  const withProgress = (l: Lesson) => ({
    ...l,
    progress: progressByLesson.get(l.id) ?? null,
  });

  const grouped = modules.map((m) => ({
    ...m,
    lessons: lessons.filter((l) => l.module_id === m.id).map(withProgress),
  }));

  const allLessonRows = grouped.flatMap((m) => m.lessons);
  const unassigned = lessons
    .filter((l) => !l.module_id)
    .map(withProgress);
  const total = allLessonRows.length + unassigned.length;
  const completed = [...allLessonRows, ...unassigned].filter(
    (l) => l.progress?.progress_percentage === 100,
  ).length;

  return {
    course: course as Course,
    subject: course.subjects?.name ?? null,
    className: course.classes?.name ?? null,
    teacherName: course.teachers?.display_name ?? null,
    modules: grouped,
    unassignedLessons: unassigned,
    totalLessons: total,
    completedLessons: completed,
    overallPercentage: total ? Math.round((completed / total) * 100) : 0,
  };
}

export type StudentLessonView = {
  course: Course | null;
  moduleTitle: string | null;
  lesson: Lesson | null;
  materials: LessonMaterial[];
  progress: LessonProgress | null;
  prevLesson: Lesson | null;
  nextLesson: Lesson | null;
};

export async function getStudentLessonView(
  schoolId: string,
  studentId: string,
  courseId: string,
  lessonId: string,
): Promise<StudentLessonView> {
  const supabase = await createSupabaseServerClient();

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .eq("school_id", schoolId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (courseError) throw new Error(courseError.message);

  if (!course) {
    return { course: null, moduleTitle: null, lesson: null, materials: [], progress: null, prevLesson: null, nextLesson: null };
  }

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .eq("school_id", schoolId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (lessonError) throw new Error(lessonError.message);
  if (!lesson) {
    return { course: course as Course, moduleTitle: null, lesson: null, materials: [], progress: null, prevLesson: null, nextLesson: null };
  }

  const [materialsRes, progressRes, lessonsRes] = await Promise.all([
    supabase
      .from("lesson_materials")
      .select("*")
      .eq("lesson_id", lessonId)
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("lesson_progress")
      .select("*")
      .eq("student_id", studentId)
      .eq("lesson_id", lessonId)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase
      .from("lessons")
      .select("*")
      .eq("course_id", courseId)
      .eq("school_id", schoolId)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  const lessons = (lessonsRes.data ?? []) as Lesson[];
  const index = lessons.findIndex((l) => l.id === lessonId);

  let moduleTitle: string | null = null;
  if (lesson.module_id) {
    const { data: mod } = await supabase
      .from("course_modules")
      .select("title")
      .eq("id", lesson.module_id)
      .eq("school_id", schoolId)
      .maybeSingle();
    moduleTitle = mod?.title ?? null;
  }

  // Record that the student has started this lesson.
  await recordLessonStart(schoolId, studentId, lessonId);

  return {
    course: course as Course,
    moduleTitle,
    lesson: lesson as Lesson,
    materials: materialsRes.data ?? [],
    progress: progressRes.data ?? null,
    prevLesson: index > 0 ? lessons[index - 1] : null,
    nextLesson: index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null,
  };
}

async function recordLessonStart(
  schoolId: string,
  studentId: string,
  lessonId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (existing) return;

  await supabase.from("lesson_progress").insert({
    school_id: schoolId,
    student_id: studentId,
    lesson_id: lessonId,
    started_at: new Date().toISOString(),
    progress_percentage: 0,
  });
}

export async function setLessonCompletion(
  schoolId: string,
  studentId: string,
  lessonId: string,
  completed: boolean,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id, started_at")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .eq("school_id", schoolId)
    .maybeSingle();

  const payload = {
    school_id: schoolId,
    student_id: studentId,
    lesson_id: lessonId,
    started_at: existing?.started_at ?? now,
    progress_percentage: completed ? 100 : 0,
    completed_at: completed ? now : null,
  };

  const { error } = existing
    ? await supabase.from("lesson_progress").update(payload).eq("id", existing.id)
    : await supabase.from("lesson_progress").insert(payload);
  if (error) throw new Error("We couldn't update your progress.");

  // Get the lesson's course to refresh the course rollup.
  const { data: lesson } = await supabase
    .from("lessons")
    .select("course_id")
    .eq("id", lessonId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (lesson) {
    await rollupStudentCourse(schoolId, studentId, lesson.course_id);
  }
}

async function rollupStudentCourse(
  schoolId: string,
  studentId: string,
  courseId: string,
): Promise<void> {
  const admin = createAdminClient();

  const { data: lessons } = await admin
    .from("lessons")
    .select("id")
    .eq("course_id", courseId)
    .eq("status", "published")
    .is("deleted_at", null);

  const ids = (lessons ?? []).map((l) => l.id);
  let completed = 0;
  if (ids.length > 0) {
    const { data: done } = await admin
      .from("lesson_progress")
      .select("id")
      .eq("student_id", studentId)
      .eq("school_id", schoolId)
      .eq("progress_percentage", 100)
      .in("lesson_id", ids);
    completed = done?.length ?? 0;
  }

  const total = ids.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  await admin.from("student_progress").upsert(
    {
      school_id: schoolId,
      student_id: studentId,
      course_id: courseId,
      lessons_completed: completed,
      overall_percentage: pct,
      last_activity_at: new Date().toISOString(),
    },
    { onConflict: "student_id,course_id" },
  );
}

export type ContinueLearningItem = {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  progress: number;
};

export async function getContinueLearning(
  schoolId: string,
  studentId: string,
): Promise<ContinueLearningItem | null> {
  const supabase = await createSupabaseServerClient();

  const { data: inProgress } = await supabase
    .from("lesson_progress")
    .select("*, lessons!inner(id, title, course_id, courses!inner(title))")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .lt("progress_percentage", 100)
    .order("updated_at", { ascending: false })
    .limit(1);

  const pick = inProgress?.[0];
  if (pick) {
    return {
      courseId: pick.lessons.course_id,
      courseTitle: pick.lessons.courses.title,
      lessonId: pick.lessons.id,
      lessonTitle: pick.lessons.title,
      progress: pick.progress_percentage,
    };
  }

  const { data: completed } = await supabase
    .from("lesson_progress")
    .select("*, lessons!inner(id, title, course_id, courses!inner(title))")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .eq("progress_percentage", 100)
    .order("updated_at", { ascending: false })
    .limit(1);

  const lastDone = completed?.[0];
  if (!lastDone) return null;

  return {
    courseId: lastDone.lessons.course_id,
    courseTitle: lastDone.lessons.courses.title,
    lessonId: lastDone.lessons.id,
    lessonTitle: lastDone.lessons.title,
    progress: 100,
  };
}
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/auth-context";
import { requireContentEditor } from "@/services/shared";
import { studentMayAccessCourse } from "@/services/material-storage";
import { invalidateCacheByPrefix } from "@/lib/server-cache";
import { asArray } from "@/lib/embed";
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

/** PostgREST returns a to-one embed as an object; some client typings model it
 *  as a single-element array. Read it through `asArray()` either way. */
type NameEmbed = { name: string } | { name: string }[] | null;
type TeacherEmbed =
  | { display_name: string | null }
  | { display_name: string | null }[]
  | null;

export type CourseListItem = Course & {
  subjects: NameEmbed;
  classes: NameEmbed;
  teachers: TeacherEmbed;
  course_modules?: CourseModule[] | null;
  lessons?: Lesson[] | null;
};

export type LessonWithMaterials = Lesson & {
  lesson_materials?: LessonMaterial[] | null;
};

/** The course outline a teacher sees: enough to spot content without opening each lesson. */
export type LessonWithContentFlags = Lesson & {
  materialCount: number;
  hasVideo: boolean;
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

export type TeacherLessonListItem = Lesson & {
  course_title: string;
  course_id: string;
  material_count: number;
  has_video: boolean;
  video_count: number;
};

/**
 * Every lesson across a teacher's own courses, newest first.
 *
 * This is what backs /teacher/lessons. A teacher who wants to find the lesson
 * they recorded a video on should not have to open each course and expand each
 * module to find out, and the nav has a Lessons entry that needs somewhere real
 * to point.
 *
 * Scoped to courses the teacher owns, matching is_own_course() in the database.
 */
export async function listTeacherLessons(
  schoolId: string,
  teacherId: string,
): Promise<TeacherLessonListItem[]> {
  const supabase = await createSupabaseServerClient();

  // One query returns the courses this teacher owns, their lessons, and each
  // lesson's materials. This was three round trips in two phases: the course
  // lookup, then lessons and materials in parallel. It also pulled every
  // material in the whole school just to count the files on a few lessons.
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, title, lesson_rows:lessons!inner(*, lesson_materials(id, file_type, provider_playback_id, deleted_at))",
    )
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .is("lesson_rows.deleted_at", null)
    .returns<
      {
        id: string;
        title: string;
        lesson_rows: (Lesson & {
          lesson_materials: Pick<
            LessonMaterial,
            "id" | "file_type" | "provider_playback_id" | "deleted_at"
          >[];
        })[];
      }[]
    >();
  if (error) throw new Error(error.message);

  // The embedded lessons are aliased so that the two deleted_at filters above
  // each address one table: PostgREST rejects qualifying the top-level table,
  // and an unqualified filter would be ambiguous.
  return (data ?? [])
    .flatMap((course) =>
      (course.lesson_rows ?? []).map((lesson) => {
        const { lesson_materials, ...lessonFields } = lesson;
        const live = (lesson_materials ?? []).filter((m) => !m.deleted_at);
        const videos = live.filter(
          (m) => m.file_type === "video" && !!m.provider_playback_id,
        );
        return {
          ...lessonFields,
          course_id: lessonFields.course_id ?? course.id,
          course_title: course.title,
          material_count: live.length,
          has_video: videos.length > 0,
          video_count: videos.length,
        };
      }),
    )
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export async function getCourseDetail(
  schoolId: string,
  courseId: string,
): Promise<{
  course: (Course & {
    subjects: NameEmbed;
    classes: NameEmbed;
    teachers: TeacherEmbed;
  }) | null;
  modules: (CourseModule & { lessons: LessonWithContentFlags[] })[];
  unassignedLessons: LessonWithContentFlags[];
}> {
  const supabase = await createSupabaseServerClient();

  // The course row, its modules and its lessons are all keyed off the route
  // params, so none of them waits on another and they load in one phase. This
  // was a serial course lookup followed by modules, lessons and materials in
  // parallel: four round trips over two phases. Materials now ride along on the
  // lessons instead of a school-wide scan run only to count files.
  const [courseRes, modulesRes, lessonsRes] = await Promise.all([
    supabase
      .from("courses")
      .select("*, subjects(name), classes(name), teachers(display_name)")
      .eq("id", courseId)
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("course_modules")
      .select("*")
      .eq("course_id", courseId)
      .eq("school_id", schoolId)
      .order("order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("lessons")
      .select("*, lesson_materials(id, file_type, provider_playback_id, deleted_at)")
      .eq("course_id", courseId)
      .eq("school_id", schoolId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .returns<
        (Lesson & {
          lesson_materials: Pick<
            LessonMaterial,
            "id" | "file_type" | "provider_playback_id" | "deleted_at"
          >[];
        })[]
      >(),
  ]);

  const { data: course } = courseRes;
  if (courseRes.error) throw new Error(courseRes.error.message);
  if (!course) return { course: null, modules: [], unassignedLessons: [] };

  const modules = (modulesRes.data ?? []) as CourseModule[];

  const lessons = ((lessonsRes.data ?? []) as (Lesson & {
    lesson_materials?: Pick<
      LessonMaterial,
      "id" | "file_type" | "provider_playback_id" | "deleted_at"
    >[];
  })[]).map((lesson) => {
    const { lesson_materials, ...lessonFields } = lesson;
    const live = (lesson_materials ?? []).filter((m) => !m.deleted_at);
    return {
      ...lessonFields,
      materialCount: live.length,
      hasVideo: live.some((m) => m.file_type === "video" && !!m.provider_playback_id),
    };
  });

  const grouped = modules.map((m) => ({
    ...m,
    lessons: lessons.filter((l) => l.module_id === m.id),
  }));

  return {
    course: course as Course & {
      subjects: NameEmbed;
      classes: NameEmbed;
      teachers: TeacherEmbed;
    },
    modules: grouped,
    unassignedLessons: lessons.filter((l) => !l.module_id),
  };
}

export async function createCourse(input: z.infer<typeof courseSchema>): Promise<string> {
  invalidateCacheByPrefix("dash:teacher:");
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
  invalidateCacheByPrefix("dash:teacher:");
  invalidateCacheByPrefix("dash:student:");
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
  invalidateCacheByPrefix("dash:teacher:");
  invalidateCacheByPrefix("dash:student:");
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
    subjects: NameEmbed;
    classes: NameEmbed;
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
      subject: asArray(c.subjects)[0]?.name ?? null,
      className: asArray(c.classes)[0]?.name ?? null,
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
    lessons: (Lesson & {
      progress: LessonProgress | null;
      /** A video that is ready to play, not merely one that was uploaded. */
      hasVideo: boolean;
      videoSeconds: number;
      materialCount: number;
    })[];
  })[];
  unassignedLessons: (Lesson & {
    progress: LessonProgress | null;
    hasVideo: boolean;
    videoSeconds: number;
    materialCount: number;
  })[];
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

  // A course belongs to a class, so a pupil can only be shown one that belongs
  // to theirs. The check was previously left to the playback token, which meant
  // the lesson list, and the material titles under it, rendered for any course
  // whose id a pupil could guess.
  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .maybeSingle();

  const sameClass =
    course && student
      ? studentMayAccessCourse({ classId: student.class_id }, { classId: course.class_id })
      : false;

  if (!course || !sameClass) {
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

  const [modulesRes, lessonsRes, progressRes, materialsRes] = await Promise.all([
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
    // Only the counts and the file types are read here. The lesson list needs to
    // be able to say which lessons carry a video, and it has to be able to say
    // so without opening every lesson to find out -- but a pupil has no reason
    // to receive playback ids for the whole course in the page.
    supabase
      .from("lesson_materials")
      .select("lesson_id, file_type, provider_playback_id, duration_seconds")
      .eq("school_id", schoolId)
      .is("deleted_at", null),
  ]);

  const modules = (modulesRes.data ?? []) as CourseModule[];
  const lessons = (lessonsRes.data ?? []) as Lesson[];
  const progressByLesson = new Map(
    (progressRes.data ?? [] as LessonProgress[]).map((p) => [p.lesson_id, p]),
  );

  // A video that is still processing has no playback id yet, so it is not
  // counted: offering a Watch button that cannot start is worse than showing
  // nothing, and the teacher can see the processing state on their own lesson.
  const playableVideos = new Map<string, number>();
  const videoSeconds = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const m of (materialsRes.data ?? []) as Pick<
    LessonMaterial,
    "lesson_id" | "file_type" | "provider_playback_id" | "duration_seconds"
  >[]) {
    counts.set(m.lesson_id, (counts.get(m.lesson_id) ?? 0) + 1);
    if (m.file_type === "video" && m.provider_playback_id) {
      playableVideos.set(m.lesson_id, (playableVideos.get(m.lesson_id) ?? 0) + 1);
      videoSeconds.set(
        m.lesson_id,
        (videoSeconds.get(m.lesson_id) ?? 0) + (m.duration_seconds ?? 0),
      );
    }
  }

  const withProgress = (l: Lesson) => ({
    ...l,
    progress: progressByLesson.get(l.id) ?? null,
    hasVideo: (playableVideos.get(l.id) ?? 0) > 0,
    videoSeconds: videoSeconds.get(l.id) ?? 0,
    materialCount: counts.get(l.id) ?? 0,
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
    subject: asArray(course.subjects)[0]?.name ?? null,
    className: asArray(course.classes)[0]?.name ?? null,
    teacherName: asArray(course.teachers)[0]?.display_name ?? null,
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

  // Same class rule as the course page, and for the same reason: this function
  // is reachable by URL, so the course page's check is not a gate. It arrives at
  // materials, so leaving it to the playback token would render another class's
  // material titles in front of a pupil and then refuse to play them.
  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .maybeSingle();

  const sameClass =
    course && student
      ? studentMayAccessCourse({ classId: student.class_id }, { classId: course.class_id })
      : false;

  if (!course || !sameClass) {
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
  invalidateCacheByPrefix("dash:student:");
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
  /**
   * Whether this lesson actually carries a video. The dashboard used to show a
   * play glyph on this card whatever it was linking to, which taught pupils to
   * ignore the one icon that was supposed to mean "watch something".
   */
  hasVideo: boolean;
};

/** A lesson counts as watchable only once a playback id exists for a video. */
async function lessonHasPlayableVideo(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  lessonId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("lesson_materials")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("file_type", "video")
    .not("provider_playback_id", "is", null)
    .is("deleted_at", null)
    .limit(1);
  return (data ?? []).length > 0;
}

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
  const lesson = pick ? asArray(pick.lessons)[0] : undefined;
  if (pick && lesson) {
    return {
      courseId: lesson.course_id,
      courseTitle: asArray(lesson.courses)[0]?.title ?? "",
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      progress: pick.progress_percentage,
      hasVideo: await lessonHasPlayableVideo(supabase, lesson.id),
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
  const doneLesson = lastDone ? asArray(lastDone.lessons)[0] : undefined;
  if (!lastDone || !doneLesson) return null;

  return {
    courseId: doneLesson.course_id,
    courseTitle: asArray(doneLesson.courses)[0]?.title ?? "",
    lessonId: doneLesson.id,
    lessonTitle: doneLesson.title,
    progress: 100,
    hasVideo: await lessonHasPlayableVideo(supabase, doneLesson.id),
  };
}
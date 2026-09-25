import { getAuthContext } from "@/lib/auth/auth-context";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export type SearchHit = {
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

export type SearchGroup = {
  key: string;
  label: string;
  hits: SearchHit[];
};

const HIT_LIMIT = 6;

function sanitize(raw: string): string {
  return raw.replace(/[%,_\\]/g, " ").replace(/\s+/g, " ").trim();
}

function pattern(term: string): string {
  return `%${term}%`;
}

function truncate(value: string, max = 90): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

async function buildGroup(
  key: string,
  label: string,
  run: () => Promise<SearchHit[]>,
): Promise<SearchGroup | null> {
  try {
    const hits = await run();
    if (hits.length === 0) return null;
    return { key, label, hits: hits.slice(0, HIT_LIMIT) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Platform (super admin)
// ---------------------------------------------------------------------------

async function searchPlatform(query: string): Promise<SearchGroup[]> {
  const supabase = await createSupabaseServerClient();
  const p = pattern(query);

  const groups: (SearchGroup | null)[] = await Promise.all([
    buildGroup("schools", "Schools", async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, slug, status, city, state")
        .or(`name.ilike.${p},slug.ilike.${p}`)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        name: string;
        slug: string;
        status: string;
        city: string | null;
        state: string | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: [row.slug, row.city, row.state].filter(Boolean).join(" · ") ?? null,
        href: "/platform/schools",
      }));
    }),
    buildGroup("users", "People", async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .or(`full_name.ilike.${p},email.ilike.${p}`)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map(
        (row) => ({
          id: row.id,
          title: row.full_name ?? "Unnamed user",
          subtitle: row.email ?? null,
          href: "/platform/users",
        }),
      );
    }),
  ]);

  return groups.filter(Boolean) as SearchGroup[];
}

// ---------------------------------------------------------------------------
// School managers (owner / admin / principal)
// ---------------------------------------------------------------------------

async function searchSchoolManager(query: string, schoolId: string): Promise<SearchGroup[]> {
  const supabase = await createSupabaseServerClient();
  const p = pattern(query);
  const enc = encodeURIComponent(query);

  const groups: (SearchGroup | null)[] = await Promise.all([
    buildGroup("students", "Students", async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, display_name, admission_number, classes(name), streams(name)")
        .eq("school_id", schoolId)
        .or(`display_name.ilike.${p},admission_number.ilike.${p}`)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        display_name: string | null;
        admission_number: string;
        classes: { name: string }[] | null;
        streams: { name: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.display_name ?? row.admission_number,
        subtitle: [row.admission_number, row.classes?.[0]?.name, row.streams?.[0]?.name]
          .filter(Boolean)
          .join(" · ") || null,
        href: `/school/students?q=${enc}`,
      }));
    }),
    buildGroup("teachers", "Teachers", async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, display_name, staff_id")
        .eq("school_id", schoolId)
        .ilike("display_name", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as { id: string; display_name: string | null; staff_id: string | null }[]).map(
        (row) => ({
          id: row.id,
          title: row.display_name ?? "Teacher",
          subtitle: row.staff_id ?? null,
          href: "/school/teachers",
        }),
      );
    }),
    buildGroup("parents", "Parents", async () => {
      const { data, error } = await supabase
        .from("parents")
        .select("id, display_name, relationship")
        .eq("school_id", schoolId)
        .ilike("display_name", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as { id: string; display_name: string | null; relationship: string | null }[]).map(
        (row) => ({
          id: row.id,
          title: row.display_name ?? "Parent",
          subtitle: row.relationship ?? null,
          href: "/school/parents",
        }),
      );
    }),
    buildGroup("classes", "Classes", async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .ilike("name", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as { id: string; name: string }[]).map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: null,
        href: `/school/classes?q=${enc}`,
      }));
    }),
    buildGroup("subjects", "Subjects", async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, code")
        .eq("school_id", schoolId)
        .or(`name.ilike.${p},code.ilike.${p}`)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as { id: string; name: string; code: string | null }[]).map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: row.code ?? null,
        href: `/school/subjects?q=${enc}`,
      }));
    }),
    buildGroup("courses", "Courses", async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, subjects(name), classes(name)")
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        subjects: { name: string }[] | null;
        classes: { name: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: [row.subjects?.[0]?.name, row.classes?.[0]?.name].filter(Boolean).join(" · ") || null,
        href: `/teacher/courses/${row.id}`,
      }));
    }),
    buildGroup("lessons", "Lessons", async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, course_id, courses(title)")
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        course_id: string;
        courses: { title: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: row.courses?.[0]?.title ?? null,
        href: `/teacher/courses/${row.course_id}/lessons/${row.id}`,
      }));
    }),
    buildGroup("assignments", "Assignments", async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, title, classes(name), subjects(name)")
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        classes: { name: string }[] | null;
        subjects: { name: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: [row.subjects?.[0]?.name, row.classes?.[0]?.name].filter(Boolean).join(" · ") || null,
        href: `/teacher/assignments/${row.id}`,
      }));
    }),
    buildGroup("questions", "Questions", async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, question_text, topic, question_bank_id")
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .or(`question_text.ilike.${p},topic.ilike.${p}`)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        question_text: string;
        topic: string | null;
        question_bank_id: string | null;
      }[]).map((row) => ({
        id: row.id,
        title: truncate(row.question_text),
        subtitle: row.topic ?? null,
        href: row.question_bank_id
          ? `/teacher/question-bank/${row.question_bank_id}`
          : "/teacher/question-bank",
      }));
    }),
    buildGroup("examSeries", "Exam series", async () => {
      const { data, error } = await supabase
        .from("exam_series")
        .select("id, title, subjects(name), classes(name)")
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        subjects: { name: string }[] | null;
        classes: { name: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: [row.subjects?.[0]?.name, row.classes?.[0]?.name].filter(Boolean).join(" · ") || null,
        href: `/teacher/exam-series/${row.id}`,
      }));
    }),
    buildGroup("announcements", "Announcements", async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title")
        .eq("school_id", schoolId)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as { id: string; title: string }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: null,
        href: "/school/announcements",
      }));
    }),
  ]);

  return groups.filter(Boolean) as SearchGroup[];
}

// ---------------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------------

async function searchTeacher(query: string, schoolId: string): Promise<SearchGroup[]> {
  const supabase = await createSupabaseServerClient();
  const p = pattern(query);

  const groups: (SearchGroup | null)[] = await Promise.all([
    buildGroup("courses", "Courses", async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, subjects(name), classes(name)")
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        subjects: { name: string }[] | null;
        classes: { name: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: [row.subjects?.[0]?.name, row.classes?.[0]?.name].filter(Boolean).join(" · ") || null,
        href: `/teacher/courses/${row.id}`,
      }));
    }),
    buildGroup("lessons", "Lessons", async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, course_id, courses(title)")
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        course_id: string;
        courses: { title: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: row.courses?.[0]?.title ?? null,
        href: `/teacher/courses/${row.course_id}/lessons/${row.id}`,
      }));
    }),
    buildGroup("assignments", "Assignments", async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, title, classes(name), subjects(name)")
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        classes: { name: string }[] | null;
        subjects: { name: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: [row.subjects?.[0]?.name, row.classes?.[0]?.name].filter(Boolean).join(" · ") || null,
        href: `/teacher/assignments/${row.id}`,
      }));
    }),
    buildGroup("questions", "Questions", async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, question_text, topic, question_bank_id")
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .or(`question_text.ilike.${p},topic.ilike.${p}`)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        question_text: string;
        topic: string | null;
        question_bank_id: string | null;
      }[]).map((row) => ({
        id: row.id,
        title: truncate(row.question_text),
        subtitle: row.topic ?? null,
        href: row.question_bank_id
          ? `/teacher/question-bank/${row.question_bank_id}`
          : "/teacher/question-bank",
      }));
    }),
    buildGroup("examSeries", "Exam series", async () => {
      const { data, error } = await supabase
        .from("exam_series")
        .select("id, title, subjects(name), classes(name)")
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        subjects: { name: string }[] | null;
        classes: { name: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: [row.subjects?.[0]?.name, row.classes?.[0]?.name].filter(Boolean).join(" · ") || null,
        href: `/teacher/exam-series/${row.id}`,
      }));
    }),
  ]);

  return groups.filter(Boolean) as SearchGroup[];
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

async function searchStudent(
  query: string,
  schoolId: string,
  userId: string,
): Promise<SearchGroup[]> {
  const supabase = await createSupabaseServerClient();
  const p = pattern(query);

  const { data: student } = await supabase
    .from("students")
    .select("id, class_id")
    .eq("school_id", schoolId)
    .eq("user_id", userId)
    .maybeSingle();

  const studentId = student?.id;
  const classId = student?.class_id ?? null;
  if (!studentId) return [];

  const classFilter = classId
    ? `class_id.in.(${classId}),class_id.is.null`
    : "class_id.is.null";

  const groups: (SearchGroup | null)[] = await Promise.all([
    buildGroup("courses", "Courses", async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, subjects(name), classes(name)")
        .eq("school_id", schoolId)
        .eq("status", "published")
        .is("deleted_at", null)
        .or(classFilter)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        subjects: { name: string }[] | null;
        classes: { name: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: [row.subjects?.[0]?.name, row.classes?.[0]?.name].filter(Boolean).join(" · ") || null,
        href: `/student/courses/${row.id}`,
      }));
    }),
    buildGroup("lessons", "Lessons", async () => {
      const { data: visibleCourses } = await supabase
        .from("courses")
        .select("id")
        .eq("school_id", schoolId)
        .eq("status", "published")
        .is("deleted_at", null)
        .or(classFilter);
      const courseIds = ((visibleCourses ?? []) as { id: string }[]).map((c) => c.id);
      if (courseIds.length === 0) return [];

      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, course_id, courses(title)")
        .eq("school_id", schoolId)
        .eq("status", "published")
        .is("deleted_at", null)
        .in("course_id", courseIds)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        course_id: string;
        courses: { title: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: row.courses?.[0]?.title ?? null,
        href: `/student/courses/${row.course_id}/lessons/${row.id}`,
      }));
    }),
    buildGroup("assignments", "Assignments", async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, title, subjects(name), classes(name)")
        .eq("school_id", schoolId)
        .eq("status", "published")
        .is("deleted_at", null)
        .or(classFilter)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        subjects: { name: string }[] | null;
        classes: { name: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: [row.subjects?.[0]?.name, row.classes?.[0]?.name].filter(Boolean).join(" · ") || null,
        href: `/student/assignments/${row.id}`,
      }));
    }),
    buildGroup("examSeries", "Exam series", async () => {
      const { data, error } = await supabase
        .from("exam_series")
        .select("id, title, subjects(name), classes(name)")
        .eq("school_id", schoolId)
        .eq("status", "published")
        .is("deleted_at", null)
        .or(classFilter)
        .ilike("title", p)
        .limit(HIT_LIMIT);
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        subjects: { name: string }[] | null;
        classes: { name: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: [row.subjects?.[0]?.name, row.classes?.[0]?.name].filter(Boolean).join(" · ") || null,
        href: `/student/exam-series/${row.id}`,
      }));
    }),
  ]);

  return groups.filter(Boolean) as SearchGroup[];
}

// ---------------------------------------------------------------------------
// Parent
// ---------------------------------------------------------------------------

async function searchParent(query: string, schoolId: string, userId: string): Promise<SearchGroup[]> {
  const supabase = await createSupabaseServerClient();
  const p = pattern(query);

  const { data: parentRow } = await supabase
    .from("parents")
    .select("id")
    .eq("school_id", schoolId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!parentRow) return [];

  const { data: links } = await supabase
    .from("parent_student_relationships")
    .select("students(id, display_name, admission_number, class_id, classes(name))")
    .eq("school_id", schoolId)
    .eq("parent_id", parentRow.id);

  const children = (links ?? []) as unknown as {
    students: {
      id: string;
      display_name: string | null;
      admission_number: string;
      class_id: string | null;
      classes: { name: string }[] | null;
    }[] | null;
  }[];

  const childRows = children
    .map((l) => l.students?.[0])
    .filter((s): s is NonNullable<(typeof children)[0]["students"]>[0] => Boolean(s));

  const matchedChildren = childRows.filter(
    (s) =>
      s.display_name?.toLowerCase().includes(query.toLowerCase()) ||
      s.admission_number.toLowerCase().includes(query.toLowerCase()),
  );

  const classIds = [...new Set(childRows.map((s) => s.class_id).filter(Boolean))] as string[];

  const groups: (SearchGroup | null)[] = await Promise.all([
    buildGroup("children", "Children", async () =>
      matchedChildren.map((s) => ({
        id: s.id,
        title: `${s.display_name ?? s.admission_number} (${s.admission_number})`,
        subtitle: s.classes?.[0]?.name ?? null,
        href: "/parent/children",
      })),
    ),
    buildGroup("assignments", "Assignments", async () => {
      let queryBuilder = supabase
        .from("assignments")
        .select("id, title, subjects(name), classes(name)")
        .eq("school_id", schoolId)
        .eq("status", "published")
        .is("deleted_at", null)
        .ilike("title", p)
        .limit(HIT_LIMIT);

      queryBuilder =
        classIds.length > 0
          ? queryBuilder.or(
              `class_id.in.(${classIds.join(",")}),class_id.is.null`,
            )
          : queryBuilder.is("class_id", null);

      const { data, error } = await queryBuilder;
      if (error) throw new Error(error.message);
      return ((data ?? []) as {
        id: string;
        title: string;
        subjects: { name: string }[] | null;
        classes: { name: string }[] | null;
      }[]).map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: [row.subjects?.[0]?.name, row.classes?.[0]?.name].filter(Boolean).join(" · ") || null,
        href: "/parent/assignments",
      }));
    }),
  ]);

  return groups.filter(Boolean) as SearchGroup[];
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function runSearch(rawQuery: string): Promise<SearchGroup[]> {
  const query = sanitize(rawQuery);
  if (query.length < 2) return [];

  const context = await getAuthContext();
  if (!context.user) return [];

  const roles = context.roles;

  if (roles.includes("SUPER_ADMIN")) return searchPlatform(query);

  const membership = context.memberships[0];
  if (!membership) return [];

  const schoolId = membership.school.id;

  if (
    roles.includes("SCHOOL_OWNER") ||
    roles.includes("SCHOOL_ADMIN") ||
    roles.includes("PRINCIPAL")
  ) {
    return searchSchoolManager(query, schoolId);
  }
  if (roles.includes("TEACHER")) return searchTeacher(query, schoolId);
  if (roles.includes("STUDENT")) return searchStudent(query, schoolId, context.user.id);
  if (roles.includes("PARENT")) return searchParent(query, schoolId, context.user.id);

  return [];
}
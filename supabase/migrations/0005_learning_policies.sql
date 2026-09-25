-- =============================================================================
-- EduSphere — Phase 2 (Learning): content authoring + progress RLS policies
--
-- Extends the generic school-admin-only policy loop in 0002 so that:
--   * TEACHERS can author courses, modules, lessons and materials within
--     their school (and only edit/delete content they own).
--   * STUDENTS can record their own lesson / course progress.
-- Admin (owner/admin) and super-admin powers are unchanged.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_teacher(p_school_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and school_id = p_school_id
      and role = 'TEACHER'
  );
$$;

create or replace function public.is_student(p_school_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and school_id = p_school_id
      and role = 'STUDENT'
  );
$$;

create or replace function public.self_teacher_id(p_school_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select t.id
  from public.teachers t
  where t.school_id = p_school_id
    and t.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.self_student_id(p_school_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select s.id
  from public.students s
  where s.school_id = p_school_id
    and s.user_id = auth.uid()
  limit 1;
$$;

-- True when the current user owns the course (admin-built courses have a null
-- teacher_id and are managed only by school admins / super admins).
create or replace function public.is_own_course(p_school_id uuid, p_course_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.courses c
    where c.id = p_course_id
      and c.school_id = p_school_id
      and c.teacher_id = public.self_teacher_id(p_school_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- courses: teachers may create, and own their own course rows
-- ---------------------------------------------------------------------------
create policy "p_courses_insert_editor"
  on public.courses for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_teacher(school_id)
      and teacher_id = public.self_teacher_id(school_id)
    )
  );

create policy "p_courses_update_editor"
  on public.courses for update
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and teacher_id = public.self_teacher_id(school_id))
  )
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and teacher_id = public.self_teacher_id(school_id))
  );

create policy "p_courses_delete_editor"
  on public.courses for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and teacher_id = public.self_teacher_id(school_id))
  );

-- ---------------------------------------------------------------------------
-- course_modules: teachers may manage modules inside courses they own
-- ---------------------------------------------------------------------------
create policy "p_course_modules_insert_editor"
  on public.course_modules for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_teacher(school_id)
      and public.is_own_course(school_id, course_id)
    )
  );

create policy "p_course_modules_update_editor"
  on public.course_modules for update
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_teacher(school_id)
      and public.is_own_course(school_id, course_id)
    )
  )
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_teacher(school_id)
      and public.is_own_course(school_id, course_id)
    )
  );

create policy "p_course_modules_delete_editor"
  on public.course_modules for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_teacher(school_id)
      and public.is_own_course(school_id, course_id)
    )
  );

-- ---------------------------------------------------------------------------
-- lessons: teachers may author lessons inside courses they own
-- ---------------------------------------------------------------------------
create policy "p_lessons_insert_editor"
  on public.lessons for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_teacher(school_id)
      and created_by = auth.uid()
      and public.is_own_course(school_id, course_id)
    )
  );

create policy "p_lessons_update_editor"
  on public.lessons for update
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  )
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  );

create policy "p_lessons_delete_editor"
  on public.lessons for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- lesson_materials: teachers may manage materials they attached to lessons
-- ---------------------------------------------------------------------------
create policy "p_lesson_materials_insert_editor"
  on public.lesson_materials for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  );

create policy "p_lesson_materials_update_editor"
  on public.lesson_materials for update
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  )
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  );

create policy "p_lesson_materials_delete_editor"
  on public.lesson_materials for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- video_resources: teachers may manage resources they attached to lessons
-- ---------------------------------------------------------------------------
create policy "p_video_resources_insert_editor"
  on public.video_resources for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  );

create policy "p_video_resources_update_editor"
  on public.video_resources for update
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  )
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  );

create policy "p_video_resources_delete_editor"
  on public.video_resources for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- content_categories: teachers may add shared categories; only admins edit/delete
-- ---------------------------------------------------------------------------
create policy "p_content_categories_insert_editor"
  on public.content_categories for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or public.is_teacher(school_id)
  );

-- ---------------------------------------------------------------------------
-- progress: a student may only record their own lesson / course progress
-- ---------------------------------------------------------------------------
create policy "p_lesson_progress_student_insert"
  on public.lesson_progress for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_student(school_id)
      and student_id = public.self_student_id(school_id)
    )
  );

create policy "p_lesson_progress_student_update"
  on public.lesson_progress for update
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_student(school_id)
      and student_id = public.self_student_id(school_id)
    )
  )
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_student(school_id)
      and student_id = public.self_student_id(school_id)
    )
  );

create policy "p_student_progress_student_insert"
  on public.student_progress for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_student(school_id)
      and student_id = public.self_student_id(school_id)
    )
  );

create policy "p_student_progress_student_update"
  on public.student_progress for update
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_student(school_id)
      and student_id = public.self_student_id(school_id)
    )
  )
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_student(school_id)
      and student_id = public.self_student_id(school_id)
    )
  );
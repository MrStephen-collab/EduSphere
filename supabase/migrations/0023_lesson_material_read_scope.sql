-- EduSphere — Lesson materials: scope reads to the class they belong to
--
-- 0002 gave every table in the school a flat select policy:
--
--   using (is_super_admin() or is_school_member(school_id))
--
-- and is_school_member() is true for any row in user_roles, pupils included. For
-- most tables that is a broad read of rows the application then filters. For
-- lesson_materials it is not: the row carries the Mux playback id, the storage
-- path and the original file name for every lesson in the school, so any pupil
-- could select another class's uploads wholesale. The application only checked
-- the class on the click that mints a playback token
-- (material-storage.ts authorizeMaterialRead), which meant the titles and file
-- types were readable and the Watch button failed afterwards.
--
-- This narrows the read to who the material is actually for:
--
--   * a manager, and a super admin, read anything in their school -- unchanged;
--   * a teacher reads materials on lessons in courses they own;
--   * a pupil reads materials on published lessons in published courses that
--     belong to their own class.
--
-- Soft-deleted rows are excluded for everyone. 0002's policy never mentioned
-- deleted_at, so a removed upload stayed readable to every member of the school;
-- the application hid it with .is("deleted_at", null) on every query, which is
-- the same mistake this migration is here to stop making. Managers can still
-- purge and restore through the service role, which bypasses this policy.
--
-- Teachers lose the ability to read a colleague's uploads. That is deliberate
-- and is the same trade as 0022: the timetable is shared deliberately, another
-- teacher's video is not, and courses already worked this way through
-- is_own_course() in 0005.

drop policy if exists p_lesson_materials_select on public.lesson_materials;

create policy "p_lesson_materials_select"
  on public.lesson_materials for select
  using (
    lesson_materials.deleted_at is null
    and (
      public.is_super_admin()
      or public.is_school_admin(lesson_materials.school_id)
      or (
        public.is_teacher(lesson_materials.school_id)
        and exists (
          select 1
          from public.lessons l
          where l.id = lesson_materials.lesson_id
            and l.deleted_at is null
            and public.is_own_course(lesson_materials.school_id, l.course_id)
        )
      )
      or (
        public.is_student(lesson_materials.school_id)
        and public.self_student_id(lesson_materials.school_id) is not null
        and exists (
          select 1
          from public.lessons l
          join public.courses c on c.id = l.course_id
          join public.students s on s.id = public.self_student_id(lesson_materials.school_id)
          where l.id = lesson_materials.lesson_id
            and l.status = 'published'
            and l.deleted_at is null
            and c.status = 'published'
            and c.deleted_at is null
            and c.school_id = lesson_materials.school_id
            and c.class_id = s.class_id
        )
      )
    )
  );
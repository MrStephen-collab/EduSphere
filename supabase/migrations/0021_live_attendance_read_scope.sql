-- EduSphere — Live teaching: narrow the attendance read policy
--
-- 0020 granted attendance reads to any member of the school via
-- is_school_member(school_id). That is true for students as well as staff, so
-- every pupil in a school could select every live_attendance_records row for
-- that school and read the full register of every other pupil in every class.
-- The application never exposed those rows, but the table is reachable through
-- PostgREST, so the policy is the boundary and the policy was wrong.
--
-- The intended audience is narrower than "the school":
--   * a manager can read any register in the school;
--   * a teacher can read the register for a class they actually teach, so the
--     list they can open matches the list they can mark;
--   * a pupil can read only their own mark, so they can see whether they were
--     recorded present without seeing anybody else's.
--
-- Written as a corrective migration rather than an edit to 0020, which has
-- already been applied.

drop policy if exists p_live_attendance_select on public.live_attendance_records;

create policy "p_live_attendance_select"
  on public.live_attendance_records for select
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or public.is_self_student(student_id, school_id)
    or (
      public.is_teacher(school_id)
      and exists (
        select 1
        from public.live_sessions ls
        where ls.id = live_session_id
          and public.teaches_class(ls.class_id, school_id)
      )
    )
  );

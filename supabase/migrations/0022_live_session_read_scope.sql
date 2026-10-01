-- EduSphere — Live teaching: narrow the session read policy
--
-- 0020 let any teacher in the school read any session, on the same footing as
-- the timetable, where the grid is deliberately shared: a colleague's timetable
-- is not a secret, because a published timetable is what the school publishes.
--
-- A live session is not that. Its join_url is the credential to a room: the
-- teacher put their own Zoom account in there, and an unannounced draft is a
-- link they have not tested. Handing either to every teacher in the school,
-- including the ones who do not teach the class, is not a collaboration
-- feature -- it is the join link leaking sideways.
--
-- So reads now match writes: a manager sees the school, a teacher sees the
-- classes assigned to them, and a student sees an announced session in their
-- own class. Nothing that owns a class loses access; the only loss is access to
-- somebody else's room.
--
-- 0022 rather than an edit to 0020, which is already applied.

drop policy if exists p_live_sessions_select on public.live_sessions;

create policy "p_live_sessions_select"
  on public.live_sessions for select
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and public.teaches_class(class_id, school_id))
    or (
      public.is_student(school_id)
      and is_visible_to_students
      and public.self_student_id(school_id) is not null
      and exists (
        select 1
        from public.students s
        where s.id = public.self_student_id(school_id)
          and s.class_id = live_sessions.class_id
      )
    )
  );
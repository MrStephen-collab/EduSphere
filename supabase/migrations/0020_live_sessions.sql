-- 0020: live teaching sessions.
--
-- A teacher announces a lesson that happens at a time rather than on demand,
-- and the students who should be there get a link to it.
--
-- The link is external and stored as written. EduSphere does not run a meeting
-- server, does not proxy the video, and cannot know whether a student actually
-- turned up -- so it schedules and takes a register, and Zoom or Meet or Teams
-- does the teaching. Trying to abstract over that by keeping a provider column
-- would imply knowledge the app does not have: it cannot tell a Google Meet
-- room from a Zoom one, cannot create either, and cannot revoke a link it did
-- not issue.
--
-- is_visible_to_students exists because "scheduled" and "announced" are
-- different. A teacher setting up tomorrow's class should be able to save it
-- before the students know, and an unrehearsed link going out to a whole class
-- is the kind of thing that happens to somebody once.
--
-- Attendance is a register the teacher marks, not telemetry. The join happens on
-- somebody else's infrastructure, so the only honest record of who was present
-- is one a person keeps. The status enum is reused from 0012_attendance.sql
-- rather than invented again.

create type public.live_session_status as enum ('scheduled', 'live', 'ended', 'cancelled');

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  -- Optional, because a revision session belongs to a course and a lesson and a
  -- catch-up session belongs to neither.
  course_id uuid references public.courses (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  title text not null,
  description text,
  join_url text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.live_session_status not null default 'scheduled',
  is_visible_to_students boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.live_attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  live_session_id uuid not null references public.live_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.attendance_status not null default 'present',
  marked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (live_session_id, student_id)
);

-- The student's list: their class, soonest first.
create index if not exists live_sessions_class_start_idx
  on public.live_sessions (class_id, starts_at);

-- A teacher opening their own timetable of live work.
create index if not exists live_sessions_school_start_idx
  on public.live_sessions (school_id, starts_at desc);

create index if not exists live_attendance_session_idx
  on public.live_attendance_records (live_session_id, status);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- The same rule the timetable uses: a school manager may write anything in the
-- school, a teacher may write the classes they are assigned to. The sessions
-- read rule has one extra condition -- a session that has not been announced is
-- invisible to students -- because an unrehearsed join link is not something to
-- hand to a class by accident.
-- ---------------------------------------------------------------------------

alter table public.live_sessions enable row level security;

create policy "p_live_sessions_select"
  on public.live_sessions for select
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or public.is_teacher(school_id)
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

create policy "p_live_sessions_insert_editor"
  on public.live_sessions for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and public.teaches_class(class_id, school_id))
  );

create policy "p_live_sessions_update_editor"
  on public.live_sessions for update
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and public.teaches_class(class_id, school_id))
  )
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and public.teaches_class(class_id, school_id))
  );

create policy "p_live_sessions_delete_editor"
  on public.live_sessions for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and public.teaches_class(class_id, school_id))
  );

alter table public.live_attendance_records enable row level security;

-- Students see their own register entry, so they can tell whether they were
-- marked present. A class register is not.
create policy "p_live_attendance_select"
  on public.live_attendance_records for select
  using (
    public.is_super_admin()
    or public.is_school_member(school_id)
    or public.is_self_student(student_id, school_id)
  );

-- Marking is for the teacher who owns the class, or a manager.
create policy "p_live_attendance_insert_editor"
  on public.live_attendance_records for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
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

create policy "p_live_attendance_update_editor"
  on public.live_attendance_records for update
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_teacher(school_id)
      and exists (
        select 1
        from public.live_sessions ls
        where ls.id = live_session_id
          and public.teaches_class(ls.class_id, school_id)
      )
    )
  )
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
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

create policy "p_live_attendance_delete_editor"
  on public.live_attendance_records for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
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

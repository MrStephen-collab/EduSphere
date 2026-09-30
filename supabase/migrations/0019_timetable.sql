-- 0019: the class timetable.
--
-- A school runs a repeating weekly grid: on a given day and period, a class is
-- doing a subject with a teacher. Two tables, because the shape of the week is
-- a school-wide decision while the lessons themselves are per class.
--
-- timetable_periods is the school's declaration of its day -- "Period 1, 08:00
-- to 08:45", and a lunch break -- and is shared by every class. Two schools
-- disagree about when period 3 starts, so the periods belong to the school and
-- not to any class.
--
-- timetable_entries is one cell of the grid. A cell can be empty: a class has
-- no lesson in period 6 on Friday, and nothing is better than a row saying so.
--
-- Scoped to an academic session rather than to a term, because a timetable
-- usually survives a term change and is rewritten between sessions. The unique
-- key includes session_id so loading next year's grid cannot collide with this
-- year's.
--
-- The write policy is deliberately narrower than 0012_attendance.sql gives. That
-- migration lets any teacher in the school write any class's register, and
-- enforces the real rule in TypeScript. A timetable is the same shape of rule --
-- a teacher should edit the classes they are assigned to and nothing else -- so
-- it is expressed in RLS here instead, via teaches_class(), and the service
-- checks it again only to produce a readable error message.

create table if not exists public.timetable_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  seq integer not null default 0,
  is_break boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- seq is the display order and the identity of a period within the day. Two
  -- periods cannot claim the same position or the grid would have two cells in
  -- one row.
  unique (school_id, seq),
  check (end_time > start_time)
);

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  session_id uuid not null references public.academic_sessions (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  period_id uuid not null references public.timetable_periods (id) on delete cascade,
  -- ISO weekday, 1 = Monday through 6 = Saturday. Sunday is not a school day
  -- in any of the markets this was built for, and leaving 7 in would let a row
  -- exist that the grid could never render.
  day_of_week smallint not null check (day_of_week between 1 and 6),
  subject_id uuid references public.subjects (id) on delete set null,
  teacher_id uuid references public.teachers (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One lesson per class per period per day. The database, not the editor, is
  -- what stops a double booking of a single class.
  unique (class_id, session_id, day_of_week, period_id)
);

create index if not exists timetable_periods_school_seq_idx
  on public.timetable_periods (school_id, seq);

-- The grid query: one class, one session, ordered for render.
create index if not exists timetable_entries_grid_idx
  on public.timetable_entries (class_id, session_id, day_of_week, period_id);

-- Reading a teacher's own week, and checking for a teacher double-booked in two
-- classes at once. A unique constraint cannot express that: it would need the
-- period times as a range, which is why the collision is caught in the service.
create index if not exists timetable_entries_teacher_idx
  on public.timetable_entries (teacher_id, session_id, day_of_week, period_id)
  where teacher_id is not null;

-- ---------------------------------------------------------------------------
-- RLS helper
-- ---------------------------------------------------------------------------
-- Does the caller teach this class? teacher_classes has no usable unique
-- constraint when session_id is null, so a lookup here must use exists() rather
-- than a single row or maybeSingle(). See src/lib/supabase/queries.ts, which
-- documents the same trap on the TypeScript side.
create or replace function public.teaches_class(p_class_id uuid, p_school_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.teacher_classes tc
    where tc.class_id = p_class_id
      and tc.school_id = p_school_id
      and tc.teacher_id = public.self_teacher_id(p_school_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.timetable_periods enable row level security;

create policy "p_timetable_periods_select_member"
  on public.timetable_periods for select
  using (public.is_super_admin() or public.is_school_member(school_id));

create policy "p_timetable_periods_insert_admin"
  on public.timetable_periods for insert
  with check (public.is_super_admin() or public.is_school_admin(school_id));

create policy "p_timetable_periods_update_admin"
  on public.timetable_periods for update
  using (public.is_super_admin() or public.is_school_admin(school_id))
  with check (public.is_super_admin() or public.is_school_admin(school_id));

create policy "p_timetable_periods_delete_admin"
  on public.timetable_periods for delete
  using (public.is_super_admin() or public.is_school_admin(school_id));

alter table public.timetable_entries enable row level security;

-- Any member of the school may read the grid. A student's own timetable is the
-- point of the feature, and a colleague's is not a secret.
create policy "p_timetable_entries_select_member"
  on public.timetable_entries for select
  using (public.is_super_admin() or public.is_school_member(school_id));

-- School managers may edit any class. A teacher may edit the classes they are
-- assigned to, and nothing else. Note this is the same helper the students'
-- fee visibility added to the vocabulary of this schema: the rule is written
-- once, in SQL, where it cannot be forgotten by a page that forgot to check.
create policy "p_timetable_entries_insert_editor"
  on public.timetable_entries for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and public.teaches_class(class_id, school_id))
  );

create policy "p_timetable_entries_update_editor"
  on public.timetable_entries for update
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

create policy "p_timetable_entries_delete_editor"
  on public.timetable_entries for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and public.teaches_class(class_id, school_id))
  );

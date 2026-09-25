-- =============================================================================
-- EduSphere — Daily attendance registers & report-card attendance
--
-- A class register marks each student's daily attendance. Report cards then
-- aggregate records for the selected term/session period into a single line
-- (days present + rate, plus absent / late / excused counts).
--
--   * attendance_records.date     — the school day (SQL date).
--   * attendance_records.status   — present | late | absent | excused.
--   * One row per (student_id, date) — a later register save overwrites the
--     day (ON CONFLICT), so a class can be re-marked.
--   * marked_by keeps a trail of who took the register.
--   * RLS: any school member may read; teachers and school managers write.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum + table
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.attendance_status as enum ('present', 'late', 'absent', 'excused');
exception when duplicate_object then null; end $$;

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null,
  status public.attendance_status not null default 'present',
  marked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);

-- registers are looked up by (class, date); report cards read per class + period
create index attendance_records_class_date_idx
  on public.attendance_records (class_id, date);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.attendance_records enable row level security;

create policy "p_attendance_records_select_member"
  on public.attendance_records for select
  using (public.is_super_admin() or public.is_school_member(school_id));

create policy "p_attendance_records_insert_staff"
  on public.attendance_records for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or public.is_teacher(school_id)
  );

create policy "p_attendance_records_update_staff"
  on public.attendance_records for update
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or public.is_teacher(school_id)
  )
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or public.is_teacher(school_id)
  );

create policy "p_attendance_records_delete_staff"
  on public.attendance_records for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or public.is_teacher(school_id)
  );
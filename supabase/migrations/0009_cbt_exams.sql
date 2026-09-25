-- =============================================================================
-- EduSphere — Phase 3 (Full CBT): timed papers + sections
--
-- Turns exam series into proper computer-based tests:
--   * exam_series.duration_minutes    (null = untimed practice, otherwise a
--                                       countdown timer hard-stops the paper)
--   * exam_series.shuffle_questions   (server shuffles question order per run)
--   * exam_sections                   (e.g. "Paper 1 — Objectives") with an
--                                       ordered list; questions reference a
--                                       section (nullable → "General" bucket)
--   * practice_attempts.duration_minutes (timer snapshot taken when the learner
--                                       starts an attempt, so later edits to
--                                       the series cannot cheat an in-flight run)
--
-- Timing model:
--   * A student starts an attempt through the page (in_progress), which records
--     started_at + duration_minutes from the series.
--   * On submit, the server compares now() vs started_at + duration and marks
--     the attempt "timed_out" if the clock expired, otherwise "submitted".
--   * Untimed attempts never time out (duration_minutes is null).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- exam_series: CBT settings
-- ---------------------------------------------------------------------------
alter table public.exam_series
  add column duration_minutes integer,
  add column shuffle_questions boolean not null default false;

alter table public.exam_series
  add constraint exam_series_duration_minutes_check
  check (duration_minutes is null or duration_minutes between 1 and 600);

-- ---------------------------------------------------------------------------
-- exam_sections: ordered sections within a series
-- ---------------------------------------------------------------------------
create table public.exam_sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  series_id uuid not null references public.exam_series (id) on delete cascade,
  title text not null,
  instructions text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, position)
);

create index exam_sections_series_idx on public.exam_sections (series_id);
create index exam_sections_school_idx on public.exam_sections (school_id);
create trigger exam_sections_set_updated_at
  before update on public.exam_sections
  for each row execute function public.set_updated_at();

-- questions may now belong to a section (nullable → general, unsectioned)
alter table public.questions
  add column section_id uuid references public.exam_sections (id) on delete set null;

create index questions_section_idx on public.questions (section_id);

-- ---------------------------------------------------------------------------
-- practice_attempts: snapshot the timer for in-flight runs
-- ---------------------------------------------------------------------------
alter table public.practice_attempts
  add column duration_minutes integer;

-- ---------------------------------------------------------------------------
-- exam_sections RLS: members read; school admins + owning teachers manage
-- ---------------------------------------------------------------------------
alter table public.exam_sections enable row level security;

create policy "p_exam_sections_select"
  on public.exam_sections for select
  using (public.is_super_admin() or public.is_school_member(school_id));

create policy "p_exam_sections_insert_editor"
  on public.exam_sections for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and public.is_own_series(school_id, series_id))
  );

create policy "p_exam_sections_update_editor"
  on public.exam_sections for update
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and public.is_own_series(school_id, series_id))
  )
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and public.is_own_series(school_id, series_id))
  );

create policy "p_exam_sections_delete_editor"
  on public.exam_sections for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and public.is_own_series(school_id, series_id))
  );
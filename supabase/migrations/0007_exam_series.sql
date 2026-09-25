-- =============================================================================
-- EduSphere — Phase 3 (Exam series + practice): national/board exam series
--
-- Adds a school-scoped catalogue of exam series (Common Entrance, WAEC, NECO,
-- JAMB and school-format papers), links question banks to a series, and adds
-- student practice attempts with auto-marked answers.
--
-- Model:
--   exam_series (catalogue entry, e.g. "WAEC Mathematics 2019-2024")
--     └── question_banks.exam_series_id   (a series' bank of questions)
--           └── questions + question_options
--   practice_attempts + practice_answers  (student attempt on a series)
--
-- RLS rules:
--   * TEACHERS author exam series and own their rows (created_by = auth.uid())
--     and may author/own question banks.
--   * STUDENTS may create and view their own practice attempts/answers.
--   * TEACHERS may view attempts/answers on series they created.
--   * School admins / super admins keep full powers via the 0002 loop.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum: exam series type
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.exam_series_type as enum (
    'common_entrance',
    'waec',
    'neco',
    'jamb',
    'school'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- exam_series catalogue
-- ---------------------------------------------------------------------------
create table public.exam_series (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  exam_type public.exam_series_type not null,
  title text not null,
  year text,
  description text,
  subject_id uuid references public.subjects (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  status public.content_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index exam_series_school_id_idx on public.exam_series (school_id);
create index exam_series_subject_id_idx on public.exam_series (subject_id);
create index exam_series_class_id_idx on public.exam_series (class_id);
create trigger exam_series_set_updated_at
  before update on public.exam_series
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- question_banks: link to a series + lifecycle flags
-- ---------------------------------------------------------------------------
alter table public.question_banks
  add column exam_series_id uuid references public.exam_series (id) on delete cascade,
  add column status public.content_status not null default 'draft',
  add column deleted_at timestamptz;

create index question_banks_exam_series_idx on public.question_banks (exam_series_id);

-- ---------------------------------------------------------------------------
-- student practice attempts
-- ---------------------------------------------------------------------------
create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  exam_series_id uuid not null references public.exam_series (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric(10,2),
  total_marks numeric(10,2),
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  time_used_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index practice_attempts_school_id_idx on public.practice_attempts (school_id);
create index practice_attempts_series_idx on public.practice_attempts (exam_series_id);
create index practice_attempts_student_idx on public.practice_attempts (student_id);
create index practice_attempts_student_series_idx on public.practice_attempts (student_id, exam_series_id);
create trigger practice_attempts_set_updated_at
  before update on public.practice_attempts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- auto-marked answers for a practice attempt
-- ---------------------------------------------------------------------------
create table public.practice_answers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  attempt_id uuid not null references public.practice_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  selected_option_id uuid references public.question_options (id) on delete set null,
  is_correct boolean,
  marks_awarded numeric(10,2),
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index practice_answers_school_id_idx on public.practice_answers (school_id);
create index practice_answers_attempt_idx on public.practice_answers (attempt_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- True when the current user owns the exam series (admin-built series have a
-- null created_by and are managed only by school admins / super admins).
create or replace function public.is_own_series(p_school_id uuid, p_series_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.exam_series es
    where es.id = p_series_id
      and es.school_id = p_school_id
      and es.created_by = auth.uid()
  );
$$;

-- True when the practice attempt belongs to one of the current teacher's series.
create or replace function public.is_own_attempt(p_school_id uuid, p_attempt_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.practice_attempts pa
    join public.exam_series es on es.id = pa.exam_series_id
    where pa.id = p_attempt_id
      and pa.school_id = p_school_id
      and es.created_by = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- enable RLS on new tables
-- ---------------------------------------------------------------------------
alter table public.exam_series enable row level security;
alter table public.practice_attempts enable row level security;
alter table public.practice_answers enable row level security;

-- ---------------------------------------------------------------------------
-- exam_series: members read; teachers author/own; admins manage
-- ---------------------------------------------------------------------------
create policy "p_exam_series_select"
  on public.exam_series for select
  using (public.is_super_admin() or public.is_school_member(school_id));

create policy "p_exam_series_insert_editor"
  on public.exam_series for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  );

create policy "p_exam_series_update_editor"
  on public.exam_series for update
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

create policy "p_exam_series_delete_editor"
  on public.exam_series for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- question_banks: teachers may author/own banks (in addition to admin policies)
-- ---------------------------------------------------------------------------
create policy "p_question_banks_insert_editor"
  on public.question_banks for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  );

create policy "p_question_banks_update_editor"
  on public.question_banks for update
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

create policy "p_question_banks_delete_editor"
  on public.question_banks for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_teacher(school_id) and created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- practice_attempts: students own/read their attempts; teachers read theirs
-- ---------------------------------------------------------------------------
create policy "p_practice_attempts_select"
  on public.practice_attempts for select
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_student(school_id)
      and student_id = public.self_student_id(school_id)
    )
    or (
      public.is_teacher(school_id)
      and public.is_own_attempt(school_id, id)
    )
  );

create policy "p_practice_attempts_insert"
  on public.practice_attempts for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_student(school_id)
      and student_id = public.self_student_id(school_id)
    )
  );

-- Scoring is applied by the server (service-role) so no student update policy.

-- ---------------------------------------------------------------------------
-- practice_answers: students own/read answers on their attempts
-- ---------------------------------------------------------------------------
create policy "p_practice_answers_select"
  on public.practice_answers for select
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_student(school_id)
      and exists (
        select 1
        from public.practice_attempts pa
        where pa.id = practice_answers.attempt_id
          and pa.student_id = public.self_student_id(practice_answers.school_id)
      )
    )
    or (
      public.is_teacher(school_id)
      and public.is_own_attempt(school_id, attempt_id)
    )
  );

create policy "p_practice_answers_insert"
  on public.practice_answers for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_student(school_id)
      and exists (
        select 1
        from public.practice_attempts pa
        where pa.id = practice_answers.attempt_id
          and pa.student_id = public.self_student_id(practice_answers.school_id)
      )
    )
  );
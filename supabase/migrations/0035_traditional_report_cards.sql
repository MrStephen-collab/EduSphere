-- =============================================================================
-- EduSphere — Traditional report cards
--
-- The paper-style "End of Term Report Sheet" a school fills in by hand. Unlike
-- the analytics report card (computed on the fly from graded assignments,
-- practice attempts and attendance), this card is manually authored: subject
-- scores, affective/psychomotor ratings and comments are typed in by a teacher
-- or school admin and must be stored exactly as entered so it can be reprinted
-- later.
--
-- One card per student per term. The snapshot columns (student_name,
-- class_name, session_name, term_name, …) are written at save time so a later
-- class transfer or rename never rewrites a historical report card.
--
-- Access model:
--   * SELECT — school managers see every card in their school; a teacher sees
--              cards for a class they are linked to; a student sees their own;
--              a linked parent sees their child's.
--   * Writes — through trusted server code via the service role after
--              requireContentEditor() has checked the caller (no INSERT /
--              UPDATE / DELETE policy, matching 0028 and 0034).
-- =============================================================================

create table if not exists public.traditional_report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  term_id uuid not null references public.terms (id) on delete cascade,

  -- Snapshot of what was printed. Deliberately duplicated: a report card is a
  -- historical document, not a live view of the student record.
  student_name text not null,
  admission_number text,
  class_name text,
  sex text,
  house text,
  session_name text,
  term_name text,

  no_on_roll integer,
  position integer,
  total_in_class integer,
  days_opened integer,
  days_present integer,
  days_absent integer,

  -- Entered rows. Shape documented in src/lib/traditional-report.ts.
  subjects jsonb not null default '[]'::jsonb,
  affective jsonb not null default '[]'::jsonb,
  psychomotor jsonb not null default '[]'::jsonb,
  comments jsonb not null default '{}'::jsonb,

  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One card per student per term; the entry form upserts on this pair.
  unique (student_id, term_id)
);

create index if not exists traditional_report_cards_school_id_idx
  on public.traditional_report_cards (school_id);
create index if not exists traditional_report_cards_class_id_idx
  on public.traditional_report_cards (class_id);
create index if not exists traditional_report_cards_term_id_idx
  on public.traditional_report_cards (term_id);
create index if not exists traditional_report_cards_student_id_idx
  on public.traditional_report_cards (student_id);

alter table public.traditional_report_cards enable row level security;

-- ---------------------------------------------------------------------------
-- Read policies
-- ---------------------------------------------------------------------------
drop policy if exists p_traditional_report_cards_select_admin on public.traditional_report_cards;
create policy "p_traditional_report_cards_select_admin"
  on public.traditional_report_cards for select
  using (public.is_super_admin() or public.is_school_admin(school_id));

drop policy if exists p_traditional_report_cards_select_teacher on public.traditional_report_cards;
create policy "p_traditional_report_cards_select_teacher"
  on public.traditional_report_cards for select
  using (
    exists (
      select 1
      from public.teacher_classes tc
      join public.teachers t on t.id = tc.teacher_id
      where t.user_id = auth.uid()
        and tc.class_id = traditional_report_cards.class_id
        and tc.school_id = traditional_report_cards.school_id
    )
  );

drop policy if exists p_traditional_report_cards_select_student on public.traditional_report_cards;
create policy "p_traditional_report_cards_select_student"
  on public.traditional_report_cards for select
  using (
    exists (
      select 1
      from public.students s
      where s.id = traditional_report_cards.student_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists p_traditional_report_cards_select_parent on public.traditional_report_cards;
create policy "p_traditional_report_cards_select_parent"
  on public.traditional_report_cards for select
  using (
    exists (
      select 1
      from public.parents p
      join public.parent_student_relationships psr on psr.parent_id = p.id
      where p.user_id = auth.uid()
        and psr.student_id = traditional_report_cards.student_id
        and psr.school_id = traditional_report_cards.school_id
    )
  );

-- No INSERT / UPDATE / DELETE policy: the entry form writes through the service
-- role in src/services/traditional-report-cards.ts after the caller has been
-- checked for a school-editor role.

-- Explicit grants so the table is reachable even when the project has the new
-- "no automatic exposure of new tables" default. RLS still decides the rows.
grant select on public.traditional_report_cards to authenticated;
grant all on public.traditional_report_cards to service_role;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists traditional_report_cards_set_updated_at on public.traditional_report_cards;
create trigger traditional_report_cards_set_updated_at
  before update on public.traditional_report_cards
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- EduSphere — Essay answers & Paper-2 marking
--
-- Adds free-text ("essay") questions on top of the objective CBT engine and the
-- teacher marking workflow for them:
--
--   * question_type gains the 'essay' value.
--   * questions.answer_guide  — teacher's marking guide / model answer / rubric
--     (never shown to students; used only on the marking screen).
--   * practice_answers.answer_text — the student's written response.
--   * practice_answers.marked_by / marked_at — the marking trail (marks_awarded
--     is the awarded score; null until the teacher marks).
--   * New RLS update policy so the series teacher can award marks on students'
--     essay answers (objective answers remain read-only — the server grades
--     them at submission time).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum: essay question type
-- ---------------------------------------------------------------------------
do $$ begin
  alter type public.question_type add value 'essay';
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- questions: answer guide for manual marking
-- ---------------------------------------------------------------------------
alter table public.questions
  add column answer_guide text;

-- ---------------------------------------------------------------------------
-- practice_answers: written response + marking trail
-- ---------------------------------------------------------------------------
alter table public.practice_answers
  add column answer_text text,
  add column marked_by uuid references public.profiles (id) on delete set null,
  add column marked_at timestamptz;

-- index for the marking queue (pending essay answers per series)
create index practice_answers_marking_idx
  on public.practice_answers (marks_awarded, question_id);

-- ---------------------------------------------------------------------------
-- RLS: teachers may award marks on answers to their own series' attempts
-- (objective answers are server-scored at submission; essays are manual)
-- ---------------------------------------------------------------------------
create policy "p_practice_answers_update_teacher"
  on public.practice_answers for update
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_teacher(school_id)
      and public.is_own_attempt(school_id, attempt_id)
    )
  )
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (
      public.is_teacher(school_id)
      and public.is_own_attempt(school_id, attempt_id)
    )
  );
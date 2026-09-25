-- =============================================================================
-- EduSphere — Parent result visibility
--
-- The parent report card (src/services/report-cards.ts) aggregates a child's
-- graded assignment submissions and submitted CBT practice attempts. Both
-- tables granted SELECT only to students/teachers/admins, so a linked parent
-- silently saw zero rows (an empty report card) despite being a school member.
--
-- This migration lets a *linked* parent read their child's rows on:
--   * assignment_submissions — graded submissions used for report cards.
--   * practice_attempts      — submitted/timed-out CBT attempts with a score.
-- The parent_student_relationships grip keeps the scope to that parent's child.
-- =============================================================================

create policy "p_assignment_submissions_select_parent"
  on public.assignment_submissions for select
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.parents p
      join public.parent_student_relationships psr
        on psr.parent_id = p.id
      where p.user_id = auth.uid()
        and psr.student_id = assignment_submissions.student_id
        and psr.school_id = assignment_submissions.school_id
    )
  );

create policy "p_practice_attempts_select_parent"
  on public.practice_attempts for select
  using (
    public.is_super_admin()
    or exists (
      select 1
      from public.parents p
      join public.parent_student_relationships psr
        on psr.parent_id = p.id
      where p.user_id = auth.uid()
        and psr.student_id = practice_attempts.student_id
        and psr.school_id = practice_attempts.school_id
    )
  );
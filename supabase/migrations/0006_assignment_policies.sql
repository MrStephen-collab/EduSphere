-- =============================================================================
-- EduSphere — Assignments: teacher authoring + student submission RLS policies
--
-- Extends the generic school-admin-only policy loop in 0002 so that:
--   * TEACHERS can create assignments, and only edit/delete ones they created.
--   * STUDENTS can create their own submission, save drafts, and submit —
--     but can never write a score/feedback.
--   * TEACHERS can read and grade submissions on assignments they created.
--   * Submission reads are privacy-scoped: students only see their own;
--     teachers only see submissions on their own assignments.
-- Admin (owner/admin) and super-admin powers are unchanged.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- assignments — teachers author their own rows
-- ---------------------------------------------------------------------------
create policy "p_assignments_insert_teacher"
  on public.assignments for insert
  with check (public.is_teacher(school_id) and created_by = auth.uid());

create policy "p_assignments_update_teacher"
  on public.assignments for update
  using (public.is_teacher(school_id) and created_by = auth.uid())
  with check (public.is_teacher(school_id) and created_by = auth.uid());

create policy "p_assignments_delete_teacher"
  on public.assignments for delete
  using (public.is_teacher(school_id) and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- assignment_submissions — students own their own; teachers grade their own
-- ---------------------------------------------------------------------------

-- Reads: the generic member-read policy (0002) exposes every submission to
-- every member. Replace it with scoped reads.
drop policy if exists p_assignment_submissions_select on public.assignment_submissions;

create policy "p_assignment_submissions_select_student"
  on public.assignment_submissions for select
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or (public.is_student(school_id) and student_id = public.self_student_id(school_id))
  );

create policy "p_assignment_submissions_select_teacher"
  on public.assignment_submissions for select
  using (
    public.is_teacher(school_id)
    and exists (
      select 1
      from public.assignments a
      where a.id = assignment_id
        and a.created_by = auth.uid()
    )
  );

-- Students create their own submission row (one per assignment).
create policy "p_assignment_submissions_insert_student"
  on public.assignment_submissions for insert
  with check (
    public.is_student(school_id)
    and student_id = public.self_student_id(school_id)
  );

-- Students can save drafts or submit — but never write a score or feedback.
create policy "p_assignment_submissions_update_student"
  on public.assignment_submissions for update
  using (public.is_student(school_id) and student_id = public.self_student_id(school_id))
  with check (
    public.is_student(school_id)
    and student_id = public.self_student_id(school_id)
    and score is null
    and feedback is null
    and graded_at is null
    and status in ('draft', 'submitted')
  );

-- Teachers grade submissions on assignments they created.
create policy "p_assignment_submissions_update_teacher"
  on public.assignment_submissions for update
  using (
    public.is_teacher(school_id)
    and exists (
      select 1
      from public.assignments a
      where a.id = assignment_id
        and a.created_by = auth.uid()
    )
  )
  with check (
    public.is_teacher(school_id)
    and exists (
      select 1
      from public.assignments a
      where a.id = assignment_id
        and a.created_by = auth.uid()
    )
  );
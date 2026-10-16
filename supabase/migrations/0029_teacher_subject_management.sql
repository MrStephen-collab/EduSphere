-- =============================================================================
-- Allow teachers to manage subjects
--
-- Teachers need to create and manage subjects for primary/secondary schools
-- where courses are not used. This replaces the admin-only write policies from
-- the generic loop in 0002 with editor policies that also allow teachers.
-- =============================================================================

drop policy if exists "p_subjects_insert" on public.subjects;
drop policy if exists "p_subjects_update" on public.subjects;
drop policy if exists "p_subjects_delete" on public.subjects;

create policy "p_subjects_insert_editor"
  on public.subjects for insert
  with check (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or public.is_teacher(school_id)
  );

create policy "p_subjects_update_editor"
  on public.subjects for update
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

create policy "p_subjects_delete_editor"
  on public.subjects for delete
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or public.is_teacher(school_id)
  );

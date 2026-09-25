-- =============================================================================
-- EduSphere — Parent portal: link rows policy
--
-- The parent portal lets a linked parent view their children's performance.
-- parent_student_relationships had RLS enabled but no policies, so no user (not
-- even the linked parent) could read them. This migration grants:
--   - select: super admins, school admins, or the parent that owns the link
--   - write: super admins and school admins only
-- Everything else the portal renders (assignments, practice attempts, report
-- cards) is already readable through the generic member-select RLS from 0002,
-- so no further policy work is needed here.
-- =============================================================================

create policy "parent_student_relationships_select_linked"
  on public.parent_student_relationships for select
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or exists (
      select 1
      from public.parents p
      where p.id = parent_id
        and p.school_id = school_id
        and p.user_id = auth.uid()
    )
  );

create policy "parent_student_relationships_insert_admin"
  on public.parent_student_relationships for insert
  with check (public.is_super_admin() or public.is_school_admin(school_id));

create policy "parent_student_relationships_update_admin"
  on public.parent_student_relationships for update
  using (public.is_super_admin() or public.is_school_admin(school_id))
  with check (public.is_super_admin() or public.is_school_admin(school_id));

create policy "parent_student_relationships_delete_admin"
  on public.parent_student_relationships for delete
  using (public.is_super_admin() or public.is_school_admin(school_id));
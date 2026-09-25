-- =============================================================================
-- EduSphere — Row Level Security Policies
-- Tenant isolation + RBAC enforced at the database layer.
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.school_settings enable row level security;
alter table public.school_branches enable row level security;
alter table public.school_domains enable row level security;
alter table public.school_branding enable row level security;
alter table public.user_roles enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.terms enable row level security;
alter table public.classes enable row level security;
alter table public.streams enable row level security;
alter table public.subjects enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.parent_student_relationships enable row level security;
alter table public.teacher_classes enable row level security;
alter table public.teacher_subjects enable row level security;
alter table public.content_categories enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_materials enable row level security;
alter table public.video_resources enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.question_banks enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.examinations enable row level security;
alter table public.examination_sections enable row level security;
alter table public.examination_questions enable row level security;
alter table public.examination_attempts enable row level security;
alter table public.examination_answers enable row level security;
alter table public.grades enable row level security;
alter table public.results enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.student_progress enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.school_events enable row level security;
alter table public.school_gallery enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.support_tickets enable row level security;

-- =============================================================================
-- profiles
-- =============================================================================
create policy "profiles_select_own_or_shared_school"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_super_admin()
    or public.shares_school_with(id)
  );

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid() or public.is_super_admin());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

create policy "profiles_delete_own"
  on public.profiles for delete
  using (id = auth.uid() or public.is_super_admin());

-- =============================================================================
-- schools
-- =============================================================================
create policy "schools_select_member_or_owner"
  on public.schools for select
  using (
    public.is_super_admin()
    or public.is_school_member(id)
    or owner_id = auth.uid()
  );

create policy "schools_insert_authenticated"
  on public.schools for insert
  with check (auth.uid() is not null);

create policy "schools_update_admin"
  on public.schools for update
  using (public.is_super_admin() or public.is_school_admin(id) or owner_id = auth.uid())
  with check (public.is_super_admin() or public.is_school_admin(id) or owner_id = auth.uid());

create policy "schools_delete_super_admin"
  on public.schools for delete
  using (public.is_super_admin());

-- =============================================================================
-- school_settings / branches / domains / branding
-- =============================================================================
create policy "school_settings_select"
  on public.school_settings for select
  using (public.is_super_admin() or public.is_school_member(school_id));

create policy "school_settings_modify"
  on public.school_settings for all
  using (public.is_super_admin() or public.is_school_admin(school_id))
  with check (public.is_super_admin() or public.is_school_admin(school_id));

create policy "school_branches_select"
  on public.school_branches for select
  using (public.is_super_admin() or public.is_school_member(school_id));

create policy "school_branches_modify"
  on public.school_branches for all
  using (public.is_super_admin() or public.is_school_admin(school_id))
  with check (public.is_super_admin() or public.is_school_admin(school_id));

create policy "school_domains_select"
  on public.school_domains for select
  using (public.is_super_admin() or public.is_school_member(school_id));

create policy "school_domains_modify"
  on public.school_domains for all
  using (public.is_super_admin() or public.is_school_admin(school_id))
  with check (public.is_super_admin() or public.is_school_admin(school_id));

create policy "school_branding_select"
  on public.school_branding for select
  using (public.is_super_admin() or public.is_school_member(school_id));

create policy "school_branding_modify"
  on public.school_branding for all
  using (public.is_super_admin() or public.is_school_admin(school_id))
  with check (public.is_super_admin() or public.is_school_admin(school_id));

-- =============================================================================
-- user_roles
-- =============================================================================
create policy "user_roles_select_self_or_shared_school"
  on public.user_roles for select
  using (
    user_id = auth.uid()
    or public.is_super_admin()
    or (
      school_id is not null and public.is_school_member(school_id)
    )
  );

create policy "user_roles_insert_admin"
  on public.user_roles for insert
  with check (
    public.is_super_admin()
    or (school_id is not null and public.is_school_admin(school_id))
  );

create policy "user_roles_update_admin"
  on public.user_roles for update
  using (public.is_super_admin() or (school_id is not null and public.is_school_admin(school_id)))
  with check (public.is_super_admin() or (school_id is not null and public.is_school_admin(school_id)));

create policy "user_roles_delete_admin"
  on public.user_roles for delete
  using (public.is_super_admin() or (school_id is not null and public.is_school_admin(school_id)));

-- =============================================================================
-- Generic school-scoped tables
-- Pattern: members read; school admins modify; super admin everything.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'academic_sessions', 'terms', 'classes', 'streams', 'subjects',
    'teachers', 'students', 'parents', 'teacher_classes', 'teacher_subjects',
    'content_categories', 'courses', 'course_modules', 'lessons',
    'lesson_materials', 'video_resources', 'assignments',
    'assignment_submissions', 'question_banks', 'questions',
    'question_options', 'examinations', 'examination_sections',
    'examination_questions', 'examination_attempts', 'examination_answers',
    'grades', 'results', 'lesson_progress', 'student_progress',
    'announcements', 'school_events', 'school_gallery',
    'subscriptions', 'payments', 'support_tickets'
  ] loop
    execute format(
      'create policy %1$I on public.%2$I for select using (public.is_super_admin() or public.is_school_member(school_id));',
      'p_' || t || '_select',
      t
    );
    execute format(
      'create policy %1$I on public.%2$I for insert with check (public.is_super_admin() or public.is_school_admin(school_id));',
      'p_' || t || '_insert',
      t
    );
    execute format(
      'create policy %1$I on public.%2$I for update using (public.is_super_admin() or public.is_school_admin(school_id)) with check (public.is_super_admin() or public.is_school_admin(school_id));',
      'p_' || t || '_update',
      t
    );
    execute format(
      'create policy %1$I on public.%2$I for delete using (public.is_super_admin() or public.is_school_admin(school_id));',
      'p_' || t || '_delete',
      t
    );
  end loop;
end;
$$;

-- =============================================================================
-- notifications — a user can only see their own notifications
-- =============================================================================
create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid() or public.is_super_admin());

create policy "notifications_insert_system"
  on public.notifications for insert
  with check (true);

-- =============================================================================
-- audit_logs — super admins and school admins for their own school
-- =============================================================================
create policy "audit_logs_select"
  on public.audit_logs for select
  using (
    public.is_super_admin()
    or (
      school_id is not null
      and (public.is_school_admin(school_id) or school_id in (
        select u.school_id from public.user_roles u where u.user_id = auth.uid()
      ))
    )
  );

create policy "audit_logs_insert"
  on public.audit_logs for insert
  with check (user_id = auth.uid() or public.is_super_admin());

-- =============================================================================
-- subscription_plans — public read (marketing), super admin modifies
-- =============================================================================
create policy "subscription_plans_select_public"
  on public.subscription_plans for select
  using (status = 'active' or public.is_super_admin());

create policy "subscription_plans_modify_super_admin"
  on public.subscription_plans for all
  using (public.is_super_admin())
  with check (public.is_super_admin());
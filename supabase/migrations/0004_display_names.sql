-- =============================================================================
-- EduSphere — Phase 2: display names for people without auth accounts
-- People can be created without an email address (offline students/staff).
-- Their name is stored here and joined with the auth profile otherwise.
-- =============================================================================

alter table public.teachers
  add column display_name text;

alter table public.students
  add column display_name text;

alter table public.parents
  add column display_name text;

-- Backfill from existing auth profiles so nothing is lost.
update public.teachers t
  set display_name = p.full_name
  from public.profiles p
  where t.user_id = p.id and t.display_name is null;

update public.students s
  set display_name = p.full_name
  from public.profiles p
  where s.user_id = p.id and s.display_name is null;

update public.parents pa
  set display_name = p.full_name
  from public.profiles p
  where pa.user_id = p.id and pa.display_name is null;
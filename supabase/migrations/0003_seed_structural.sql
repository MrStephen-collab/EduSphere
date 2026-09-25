-- =============================================================================
-- EduSphere — Development Seed Data (structural)
-- Creates Greenfield College with its academic foundation.
-- Demo auth users are created by scripts/seed.mjs (env-driven credentials).
-- =============================================================================

insert into public.schools (
  id, name, slug, motto, description, city, state, country, status
) values (
  '00000000-0000-0000-0000-000000000001',
  'Greenfield College',
  'greenfield-college',
  'Knowledge. Character. Excellence.',
  'A private secondary school providing a modern digital learning environment.',
  'Akure',
  'Ondo',
  'Nigeria',
  'active'
) on conflict (slug) do nothing;

insert into public.school_branding (school_id, primary_color, secondary_color, accent_color)
values (
  '00000000-0000-0000-0000-000000000001',
  '#2563eb',
  '#334155',
  '#0ea5e9'
) on conflict (school_id) do nothing;

insert into public.school_settings (school_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (school_id) do nothing;

insert into public.academic_sessions (id, school_id, name, is_current)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '2026/2027',
  true
) on conflict do nothing;

insert into public.terms (school_id, session_id, name, is_current)
select
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'First Term',
  true
where exists (select 1 from public.academic_sessions where id = '00000000-0000-0000-0000-000000000002')
on conflict do nothing;

insert into public.streams (school_id, name)
select '00000000-0000-0000-0000-000000000001', 'A'
where not exists (select 1 from public.streams where school_id = '00000000-0000-0000-0000-000000000001' and name = 'A');

insert into public.streams (school_id, name)
select '00000000-0000-0000-0000-000000000001', 'B'
where not exists (select 1 from public.streams where school_id = '00000000-0000-0000-0000-000000000001' and name = 'B');

insert into public.streams (school_id, name)
select '00000000-0000-0000-0000-000000000001', 'C'
where not exists (select 1 from public.streams where school_id = '00000000-0000-0000-0000-000000000001' and name = 'C');

insert into public.classes (school_id, name, "order")
select '00000000-0000-0000-0000-000000000001', name, ord
from (values
  ('JSS 1', 1),
  ('JSS 2', 2),
  ('JSS 3', 3),
  ('SS 1', 4),
  ('SS 2', 5),
  ('SS 3', 6)
) as seed(name, ord)
where not exists (select 1 from public.classes where school_id = '00000000-0000-0000-0000-000000000001' and name = seed.name);

insert into public.subjects (school_id, name, code)
select '00000000-0000-0000-0000-000000000001', name, code
from (values
  ('Mathematics', 'MTH'),
  ('English Language', 'ENG'),
  ('Physics', 'PHY'),
  ('Chemistry', 'CHM'),
  ('Biology', 'BIO'),
  ('Computer Studies', 'CSC'),
  ('Economics', 'ECO'),
  ('Government', 'GOV')
) as seed(name, code)
where not exists (select 1 from public.subjects where school_id = '00000000-0000-0000-0000-000000000001' and name = seed.name);

insert into public.grades (school_id, name, min_percentage, max_percentage, remark)
select '00000000-0000-0000-0000-000000000001', name, min_pct, max_pct, remark
from (values
  ('A', 70, 100, 'Excellent'),
  ('B', 60, 69, 'Very Good'),
  ('C', 50, 59, 'Good'),
  ('D', 40, 49, 'Pass'),
  ('E', 30, 39, 'Fair'),
  ('F', 0, 29, 'Fail')
) as seed(name, min_pct, max_pct, remark)
where not exists (select 1 from public.grades where school_id = '00000000-0000-0000-0000-000000000001' and name = seed.name);
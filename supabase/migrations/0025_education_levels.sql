-- 0025: education levels.
--
-- Until now a school was only ever a school. There was no record of whether it
-- taught infants, secondary pupils, or undergraduates, so every part of the
-- product had to assume one shape. The clearest symptom was that "class" was
-- free text: an admin typed "JSS 1" or "SS 2" into classes.name and the only
-- trace of that convention anywhere in the codebase was a hardcoded default
-- list in the onboarding wizard. Nothing validated it, nothing could branch on
-- it, and a polytechnic had no way to say what an OND year was.
--
-- A school declares one level:
--
--   nursery       Nursery 1-3
--   primary       Year 1-6
--   secondary     JSS 1-3, SS 1-3
--   college       department + Year 1-3
--   polytechnic   department + OND/HND + Year 1-2
--   university    faculty + Level 100-400
--
-- The level decides what a class is called and whether courses are grouped
-- under a department. It does not decide the class itself: classes.name stays
-- editable, because a school that calls its classes something other than the
-- convention is describing itself accurately, not making a mistake.
--
-- Backwards compatible on purpose. education_level is nullable, so an existing
-- school keeps working unchanged. A school with classes but no declared level
-- is left null rather than guessed at, so an operator sets it deliberately.

create type public.education_level as enum (
  'nursery',
  'primary',
  'secondary',
  'college',
  'polytechnic',
  'university'
);

alter table public.schools
  add column if not exists education_level public.education_level;

comment on column public.schools.education_level is
  'The level this school teaches. Decides class naming and whether courses are grouped by department. Null means not yet chosen.';

-- Departments carry the grouping for the levels that need one: a college's
-- departments, a polytechnic's, a university's faculties. One table, because
-- the three are the same row of data wearing different vocabulary, and the
-- vocabulary is presentation (see src/lib/education/levels.ts) not structure.
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Two departments cannot share a name within a school; the class and course
  -- pickers key off this, and a duplicate would render two identical options.
  unique (school_id, name)
);

create index if not exists departments_school_id_idx
  on public.departments (school_id);

comment on table public.departments is
  'Departments (college/polytechnic) and faculties (university) that group courses and classes.';

-- A polytechnic class is an OND or HND year inside a department, so the
-- programme is carried as data rather than parsed back out of the name. Only
-- polytechnic sets it; null everywhere else.
alter table public.classes
  add column if not exists department_id uuid references public.departments (id) on delete set null,
  add column if not exists programme text;

comment on column public.classes.department_id is
  'Department this class sits in, for the levels that group by department.';
comment on column public.classes.programme is
  'Polytechnic programme the class belongs to: OND or HND. Null for other levels.';

alter table public.courses
  add column if not exists department_id uuid references public.departments (id) on delete set null;

comment on column public.courses.department_id is
  'Department this course belongs to, for the levels that group by department.';

create index if not exists courses_department_id_idx
  on public.courses (department_id)
  where deleted_at is null;

create index if not exists classes_department_id_idx
  on public.classes (department_id);

-- A class or course cannot point at a department belonging to another school.
-- The plain foreign key permits that, and it would let one school read another
-- school's department names through the join.
--
-- This cannot be a CHECK constraint: Postgres does not allow a subquery in
-- CHECK, which is the only declarative way to compare two columns against
-- another table. A composite foreign key would work but ON DELETE SET NULL would
-- then clear school_id as well as department_id, so the same-school rule is
-- enforced by trigger and the delete is handled in the service that renames or
-- removes a department.
create or replace function public.enforce_department_same_school()
returns trigger
language plpgsql
as $$
begin
  if new.department_id is not null and not exists (
    select 1 from public.departments d
    where d.id = new.department_id and d.school_id = new.school_id
  ) then
    raise exception 'department % does not belong to school %', new.department_id, new.school_id
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_classes_department_same_school on public.classes;
create trigger trg_classes_department_same_school
  before insert or update on public.classes
  for each row execute function public.enforce_department_same_school();

drop trigger if exists trg_courses_department_same_school on public.courses;
create trigger trg_courses_department_same_school
  before insert or update on public.courses
  for each row execute function public.enforce_department_same_school();

alter table public.departments enable row level security;

drop policy if exists "p_departments_select_member" on public.departments;
create policy "p_departments_select_member"
  on public.departments for select
  using (public.is_super_admin() or public.is_school_member(school_id));

drop policy if exists "p_departments_insert_admin" on public.departments;
create policy "p_departments_insert_admin"
  on public.departments for insert
  with check (public.is_super_admin() or public.is_school_admin(school_id));

drop policy if exists "p_departments_update_admin" on public.departments;
create policy "p_departments_update_admin"
  on public.departments for update
  using (public.is_super_admin() or public.is_school_admin(school_id))
  with check (public.is_super_admin() or public.is_school_admin(school_id));

drop policy if exists "p_departments_delete_admin" on public.departments;
create policy "p_departments_delete_admin"
  on public.departments for delete
  using (public.is_super_admin() or public.is_school_admin(school_id));
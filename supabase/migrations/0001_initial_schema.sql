-- =============================================================================
-- EduSphere — Initial Schema
-- Multi-tenant digital learning, assessment & engagement platform.
-- Phase 1: Foundation
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.school_status as enum ('active', 'pending', 'suspended', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum (
    'SUPER_ADMIN',
    'SCHOOL_OWNER',
    'SCHOOL_ADMIN',
    'PRINCIPAL',
    'TEACHER',
    'STUDENT',
    'PARENT'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assignment_status as enum ('not_started', 'draft', 'submitted', 'late', 'graded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_type as enum (
    'multiple_choice',
    'true_false',
    'multiple_answer'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.difficulty as enum ('easy', 'medium', 'hard', 'mixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.examination_status as enum ('draft', 'published', 'closed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attempt_status as enum ('in_progress', 'submitted', 'timed_out', 'abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum (
    'assignment_due',
    'assignment_graded',
    'exam_upcoming',
    'exam_result',
    'new_lesson',
    'announcement',
    'system'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.announcement_target as enum ('school', 'class', 'students', 'teachers', 'parents');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.billing_interval as enum ('monthly', 'annual');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- profiles
-- =============================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Automatic profile creation on auth signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- schools
-- =============================================================================
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  motto text,
  description text,
  logo_url text,
  favicon_url text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  country text default 'Nigeria',
  website text,
  status public.school_status not null default 'pending',
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index schools_status_idx on public.schools (status);
create index schools_owner_id_idx on public.schools (owner_id);

create trigger schools_set_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- school_settings
-- ---------------------------------------------------------------------------
create table public.school_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  midterm_marking boolean not null default false,
  continuous_assessment_weight integer not null default 40,
  examination_weight integer not null default 60,
  allow_student_registration boolean not null default false,
  allow_parent_registration boolean not null default false,
  require_email_verification boolean not null default true,
  low_data_mode boolean not null default false,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id)
);

create trigger school_settings_set_updated_at
  before update on public.school_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- school_branches
-- ---------------------------------------------------------------------------
create table public.school_branches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  address text,
  city text,
  state text,
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index school_branches_school_id_idx on public.school_branches (school_id);
create trigger school_branches_set_updated_at
  before update on public.school_branches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- school_domains
-- ---------------------------------------------------------------------------
create table public.school_domains (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  domain text not null unique,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index school_domains_school_id_idx on public.school_domains (school_id);

-- ---------------------------------------------------------------------------
-- school_branding
-- ---------------------------------------------------------------------------
create table public.school_branding (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  primary_color text default '#2563eb',
  secondary_color text default '#334155',
  accent_color text default '#0ea5e9',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id)
);

create trigger school_branding_set_updated_at
  before update on public.school_branding
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_roles (multi-tenant memberships)
-- ---------------------------------------------------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

create index user_roles_school_id_idx on public.user_roles (school_id);
create index user_roles_user_id_idx on public.user_roles (user_id);
create unique index user_roles_unique_per_school on public.user_roles (user_id, school_id, role)
  where school_id is not null;
create unique index user_roles_unique_platform on public.user_roles (user_id, role)
  where school_id is null;

-- =============================================================================
-- academic_sessions
-- =============================================================================
create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index academic_sessions_school_id_idx on public.academic_sessions (school_id);

CREATE UNIQUE INDEX academic_sessions_one_current_per_school
  ON public.academic_sessions (school_id)
  WHERE is_current = true;

create trigger academic_sessions_set_updated_at
  before update on public.academic_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- terms
-- ---------------------------------------------------------------------------
create table public.terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  session_id uuid not null references public.academic_sessions (id) on delete cascade,
  name text not null,
  starts_at date,
  ends_at date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index terms_school_id_idx on public.terms (school_id);
create index terms_session_id_idx on public.terms (session_id);

CREATE UNIQUE INDEX terms_one_current_per_school
  ON public.terms (school_id)
  WHERE is_current = true;

create trigger terms_set_updated_at
  before update on public.terms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- classes & streams
-- ---------------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create index classes_school_id_idx on public.classes (school_id);
create trigger classes_set_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

create table public.streams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create index streams_school_id_idx on public.streams (school_id);
create trigger streams_set_updated_at
  before update on public.streams
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create index subjects_school_id_idx on public.subjects (school_id);
create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- teachers / students / parents
-- ---------------------------------------------------------------------------
create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid unique references public.profiles (id) on delete set null,
  staff_id text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, staff_id)
);

create index teachers_school_id_idx on public.teachers (school_id);
create trigger teachers_set_updated_at
  before update on public.teachers
  for each row execute function public.set_updated_at();

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid unique references public.profiles (id) on delete set null,
  admission_number text not null,
  class_id uuid references public.classes (id) on delete set null,
  stream_id uuid references public.streams (id) on delete set null,
  gender text check (gender in ('male', 'female')),
  date_of_birth date,
  guardian_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, admission_number)
);

create index students_school_id_idx on public.students (school_id);
create index students_class_id_idx on public.students (class_id);
create index students_stream_id_idx on public.students (stream_id);
create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid unique references public.profiles (id) on delete set null,
  relationship text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index parents_school_id_idx on public.parents (school_id);
create trigger parents_set_updated_at
  before update on public.parents
  for each row execute function public.set_updated_at();

create table public.parent_student_relationships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  parent_id uuid not null references public.parents (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  relation text,
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

create index parent_student_relationships_school_id_idx on public.parent_student_relationships (school_id);
create index parent_student_relationships_student_id_idx on public.parent_student_relationships (student_id);

-- ---------------------------------------------------------------------------
-- teacher assignments
-- ---------------------------------------------------------------------------
create table public.teacher_classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  session_id uuid references public.academic_sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, class_id, session_id)
);

create index teacher_classes_school_id_idx on public.teacher_classes (school_id);
create index teacher_classes_class_id_idx on public.teacher_classes (class_id);

create table public.teacher_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  session_id uuid references public.academic_sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, subject_id, session_id)
);

create index teacher_subjects_school_id_idx on public.teacher_subjects (school_id);
create index teacher_subjects_subject_id_idx on public.teacher_subjects (subject_id);

-- =============================================================================
-- courses / modules / lessons
-- =============================================================================
create table public.content_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create index content_categories_school_id_idx on public.content_categories (school_id);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  teacher_id uuid references public.teachers (id) on delete set null,
  title text not null,
  description text,
  cover_url text,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index courses_school_id_idx on public.courses (school_id);
create index courses_subject_id_idx on public.courses (subject_id);
create index courses_class_id_idx on public.courses (class_id);
create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  description text,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index course_modules_school_id_idx on public.course_modules (school_id);
create index course_modules_course_id_idx on public.course_modules (course_id);
create trigger course_modules_set_updated_at
  before update on public.course_modules
  for each row execute function public.set_updated_at();

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid references public.course_modules (id) on delete set null,
  title text not null,
  description text,
  content text,
  video_url text,
  status public.content_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index lessons_school_id_idx on public.lessons (school_id);
create index lessons_course_id_idx on public.lessons (course_id);
create index lessons_module_id_idx on public.lessons (module_id);
create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

create table public.lesson_materials (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  title text not null,
  file_type text,
  file_url text,
  file_size bigint,
  is_public boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index lesson_materials_school_id_idx on public.lesson_materials (school_id);
create index lesson_materials_lesson_id_idx on public.lesson_materials (lesson_id);
create trigger lesson_materials_set_updated_at
  before update on public.lesson_materials
  for each row execute function public.set_updated_at();

create table public.video_resources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  provider text not null default 'youtube',
  provider_video_id text not null,
  title text,
  thumbnail_url text,
  duration_seconds integer,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index video_resources_school_id_idx on public.video_resources (school_id);
create index video_resources_lesson_id_idx on public.video_resources (lesson_id);

-- ---------------------------------------------------------------------------
-- assignments
-- ---------------------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null,
  description text,
  instructions text,
  due_date timestamptz,
  max_score numeric(10,2) not null default 100,
  attachment_url text,
  status public.content_status not null default 'published',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index assignments_school_id_idx on public.assignments (school_id);
create index assignments_class_id_idx on public.assignments (class_id);
create trigger assignments_set_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  submission_text text,
  attachment_url text,
  status public.assignment_status not null default 'draft',
  score numeric(10,2),
  feedback text,
  graded_at timestamptz,
  graded_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index assignment_submissions_school_id_idx on public.assignment_submissions (school_id);
create index assignment_submissions_student_id_idx on public.assignment_submissions (student_id);
create trigger assignment_submissions_set_updated_at
  before update on public.assignment_submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- question bank
-- ---------------------------------------------------------------------------
create table public.question_banks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  subject_id uuid references public.subjects (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index question_banks_school_id_idx on public.question_banks (school_id);
create trigger question_banks_set_updated_at
  before update on public.question_banks
  for each row execute function public.set_updated_at();

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  question_bank_id uuid references public.question_banks (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  question_text text not null,
  question_type public.question_type not null default 'multiple_choice',
  topic text,
  difficulty public.difficulty not null default 'medium',
  marks numeric(10,2) not null default 1,
  explanation text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index questions_school_id_idx on public.questions (school_id);
create index questions_bank_id_idx on public.questions (question_bank_id);
create index questions_subject_id_idx on public.questions (subject_id);
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index question_options_school_id_idx on public.question_options (school_id);
create index question_options_question_id_idx on public.question_options (question_id);

-- ---------------------------------------------------------------------------
-- examinations (CBT)
-- ---------------------------------------------------------------------------
create table public.examinations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  class_id uuid references public.classes (id) on delete set null,
  session_id uuid references public.academic_sessions (id) on delete set null,
  term_id uuid references public.terms (id) on delete set null,
  title text not null,
  instructions text,
  duration_minutes integer not null default 60,
  starts_at timestamptz,
  ends_at timestamptz,
  total_marks numeric(10,2) default 0,
  pass_mark numeric(10,2) default 50,
  attempt_limit integer not null default 1,
  status public.examination_status not null default 'draft',
  randomize_questions boolean not null default false,
  randomize_options boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index examinations_school_id_idx on public.examinations (school_id);
create index examinations_subject_id_idx on public.examinations (subject_id);
create index examinations_class_id_idx on public.examinations (class_id);
create trigger examinations_set_updated_at
  before update on public.examinations
  for each row execute function public.set_updated_at();

create table public.examination_sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  examination_id uuid not null references public.examinations (id) on delete cascade,
  title text not null,
  instruction text,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create index examination_sections_school_id_idx on public.examination_sections (school_id);
create index examination_sections_exam_id_idx on public.examination_sections (examination_id);

create table public.examination_questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  examination_id uuid not null references public.examinations (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  section_id uuid references public.examination_sections (id) on delete cascade,
  position integer not null default 0,
  marks numeric(10,2) not null default 1,
  created_at timestamptz not null default now(),
  unique (examination_id, question_id)
);

create index examination_questions_school_id_idx on public.examination_questions (school_id);
create index examination_questions_exam_id_idx on public.examination_questions (examination_id);

create table public.examination_attempts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  examination_id uuid not null references public.examinations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  expires_at timestamptz,
  score numeric(10,2),
  time_used_seconds integer,
  device_info jsonb,
  suspicious_activity jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index examination_attempts_school_id_idx on public.examination_attempts (school_id);
create index examination_attempts_exam_id_idx on public.examination_attempts (examination_id);
create index examination_attempts_student_id_idx on public.examination_attempts (student_id);
create trigger examination_attempts_set_updated_at
  before update on public.examination_attempts
  for each row execute function public.set_updated_at();

create table public.examination_answers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  attempt_id uuid not null references public.examination_attempts (id) on delete cascade,
  examination_question_id uuid not null references public.examination_questions (id) on delete cascade,
  selected_option_id uuid references public.question_options (id) on delete set null,
  is_correct boolean,
  marks_awarded numeric(10,2),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (attempt_id, examination_question_id)
);

create index examination_answers_school_id_idx on public.examination_answers (school_id);
create index examination_answers_attempt_id_idx on public.examination_answers (attempt_id);

-- ---------------------------------------------------------------------------
-- results & grades
-- ---------------------------------------------------------------------------
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  min_percentage integer not null,
  max_percentage integer not null,
  remark text,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create index grades_school_id_idx on public.grades (school_id);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  examination_id uuid references public.examinations (id) on delete set null,
  attempt_id uuid unique references public.examination_attempts (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  session_id uuid references public.academic_sessions (id) on delete set null,
  term_id uuid references public.terms (id) on delete set null,
  score numeric(10,2),
  percentage numeric(5,2),
  grade_id uuid references public.grades (id) on delete set null,
  pass boolean,
  correct_count integer,
  wrong_count integer,
  time_used_seconds integer,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index results_school_id_idx on public.results (school_id);
create index results_student_id_idx on public.results (student_id);
create index results_exam_id_idx on public.results (examination_id);
create trigger results_set_updated_at
  before update on public.results
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- progress tracking
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  started_at timestamptz default now(),
  completed_at timestamptz,
  progress_percentage integer not null default 0,
  last_position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create index lesson_progress_school_id_idx on public.lesson_progress (school_id);
create index lesson_progress_student_id_idx on public.lesson_progress (student_id);
create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

create table public.student_progress (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  overall_percentage numeric(5,2) default 0,
  lessons_completed integer not null default 0,
  assignments_completed integer not null default 0,
  tests_completed integer not null default 0,
  learning_streak integer not null default 0,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create index student_progress_school_id_idx on public.student_progress (school_id);
create index student_progress_student_id_idx on public.student_progress (student_id);
create trigger student_progress_set_updated_at
  before update on public.student_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- announcements & notifications
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  message text not null,
  target_type public.announcement_target not null default 'school',
  class_id uuid references public.classes (id) on delete set null,
  published_at timestamptz default now(),
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index announcements_school_id_idx on public.announcements (school_id);
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid references public.schools (id) on delete cascade,
  type public.notification_type not null default 'system',
  title text not null,
  message text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id);
create index notifications_school_id_idx on public.notifications (school_id);

-- ---------------------------------------------------------------------------
-- events & media
-- ---------------------------------------------------------------------------
create table public.school_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  venue text,
  cover_url text,
  published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index school_events_school_id_idx on public.school_events (school_id);
create trigger school_events_set_updated_at
  before update on public.school_events
  for each row execute function public.set_updated_at();

create table public.school_gallery (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  title text,
  image_url text not null,
  category text,
  created_at timestamptz not null default now()
);

create index school_gallery_school_id_idx on public.school_gallery (school_id);

-- ---------------------------------------------------------------------------
-- subscriptions & payments
-- ---------------------------------------------------------------------------
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  price numeric(12,2) not null default 0,
  billing_interval public.billing_interval not null default 'monthly',
  student_limit integer,
  teacher_limit integer,
  feature_limits jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function public.set_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  plan_id uuid references public.subscription_plans (id) on delete set null,
  status text not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_school_id_idx on public.subscriptions (school_id);
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider text not null default 'paystack',
  provider_reference text,
  amount numeric(12,2) not null,
  currency text not null default 'NGN',
  status text not null default 'pending',
  paid_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_school_id_idx on public.payments (school_id);
create unique index payments_provider_reference_idx on public.payments (provider, provider_reference)
  where provider_reference is not null;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs & support
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  school_id uuid references public.schools (id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index audit_logs_school_id_idx on public.audit_logs (school_id);
create index audit_logs_user_id_idx on public.audit_logs (user_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  subject text not null,
  message text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_school_id_idx on public.support_tickets (school_id);
create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helper functions (security definer)
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'SUPER_ADMIN'
      and school_id is null
  );
$$;

create or replace function public.is_school_member(p_school_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and school_id = p_school_id
  );
$$;

create or replace function public.is_school_admin(p_school_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and school_id = p_school_id
      and role in ('SCHOOL_OWNER', 'SCHOOL_ADMIN')
  );
$$;

create or replace function public.shares_school_with(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles mine
    join public.user_roles theirs on theirs.school_id = mine.school_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user_id
      and mine.school_id is not null
  );
$$;
-- 0026: content categories on courses and lessons.
--
-- A course or a lesson is delivered in a shape: a video series, a slide deck, a
-- recorded lecture, a lab practical, a set of PDFs. That shape was only ever
-- discoverable after opening the lesson and looking at what had been attached
-- to it, so a student asking "is this a video or a PDF?" had no way to find out
-- from a list.
--
-- The category is chosen once, when the teacher sets the course or lesson up,
-- and it decides three things: the icon and label on the course and lesson
-- cards, and which material-upload category the lesson page opens on.
--
--   video     a recording
--   slides    a deck (ppt/pptx)
--   audio     a recording or podcast
--   pdf       a document to read or print
--   document  a worksheet or notes (doc/docx/txt)
--   image     a diagram, photograph or worksheet image
--   link      an external resource
--
--   lecture     a timetabled teaching session      } college, polytechnic
--   seminar     a discussion-led session            } and university only,
--   lab         a practical or laboratory session   } because they describe
--   project     coursework, capstone or thesis      } post-secondary teaching
--   exam_prep   revision for a particular paper     } rather than a format
--
-- Backwards compatible on purpose. content_type is nullable, so every existing
-- course and lesson keeps working and simply shows as uncategorised until a
-- teacher picks one.
--
-- See src/lib/content-categories.ts, which is the same taxonomy in the
-- application, and src/lib/education/levels.ts for the level vocabulary.

create type public.content_category as enum (
  'video',
  'slides',
  'audio',
  'pdf',
  'document',
  'image',
  'link',
  'lecture',
  'seminar',
  'lab',
  'project',
  'exam_prep'
);

alter table public.courses
  add column if not exists content_type public.content_category;

alter table public.lessons
  add column if not exists content_type public.content_category;

comment on column public.courses.content_type is
  'What this course is delivered as. Null means not categorised yet.';
comment on column public.lessons.content_type is
  'What this lesson is delivered as. Null means not categorised yet.';

-- A secondary school cannot offer a lecture, a lab or a thesis, and it should
-- not be able to record one by writing the value directly. This cannot be a
-- CHECK constraint: Postgres allows no subquery in CHECK, and the level lives on
-- another table. So the rule is a trigger, and it is the same rule the picker
-- enforces -- a school with no declared level is treated as secondary, which is
-- the fallback the whole product uses.
create or replace function public.enforce_content_category_level()
returns trigger
language plpgsql
as $$
declare
  school_level public.education_level;
begin
  if new.content_type is null then
    return new;
  end if;

  select education_level into school_level
  from public.schools
  where id = new.school_id;

  if new.content_type in ('lecture', 'seminar', 'lab', 'project', 'exam_prep')
     and coalesce(school_level, 'secondary') not in ('college', 'polytechnic', 'university') then
    raise exception 'content category % is only available to higher-education schools', new.content_type
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_courses_content_category_level on public.courses;
create trigger trg_courses_content_category_level
  before insert or update of content_type, school_id on public.courses
  for each row execute function public.enforce_content_category_level();

drop trigger if exists trg_lessons_content_category_level on public.lessons;
create trigger trg_lessons_content_category_level
  before insert or update of content_type, school_id on public.lessons
  for each row execute function public.enforce_content_category_level();

-- The lesson list is ordered newest first and the category is shown on every
-- row, so a school's content is read by category as often as by name.
create index if not exists courses_school_content_type_idx
  on public.courses (school_id, content_type)
  where deleted_at is null;

create index if not exists lessons_course_content_type_idx
  on public.lessons (course_id, content_type)
  where deleted_at is null;

-- =============================================================================
-- EduSphere — Phase 3 (Results & analytics): grade band helper
--
-- Adds a small helper that maps a percentage to the school's grade band, so
-- the app can show a grade letter alongside results and analytics everywhere
-- (student results, teacher analytics and the future parent portal).
-- No new tables are needed: analytics are computed from practice_attempts,
-- graded assignment_submissions and published results, all of which already
-- fall under the member-read / teacher-write RLS model from earlier phases.
-- =============================================================================

-- Returns the grade band name (e.g. "A", "B2", "C5") that contains
-- p_percentage for the given school, or null when no band matches.
create or replace function public.grade_for_percentage(
  p_school_id uuid,
  p_percentage numeric
)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select name
  from public.grades g
  where g.school_id = p_school_id
    and p_percentage >= g.min_percentage
    and p_percentage <= g.max_percentage
  order by g.max_percentage desc
  limit 1;
$$;
-- =============================================================================
-- Practice attempt integrity: device + suspicious-activity trail
--
-- Spec section 29 (Basic Anti-Cheating) asks the platform to detect tab
-- visibility changes, record suspicious activity and record device/session
-- information. The legacy examination_attempts table (0001) carried those two
-- jsonb columns, but the live CBT surface — practice_attempts (0007) — never
-- did, so the application had nowhere to put the trail.
--
-- Add the same columns to practice_attempts. The trail is written only by the
-- service role (there is no student update policy on practice_attempts — see
-- 0007), so a candidate cannot edit or erase their own record.
-- =============================================================================

alter table public.practice_attempts
  add column if not exists device_info jsonb;

alter table public.practice_attempts
  add column if not exists suspicious_activity jsonb not null default '[]'::jsonb;

-- The trail must stay a list of events, never an object.
alter table public.practice_attempts
  drop constraint if exists practice_attempts_suspicious_activity_is_array;

alter table public.practice_attempts
  add constraint practice_attempts_suspicious_activity_is_array
  check (jsonb_typeof(suspicious_activity) = 'array');

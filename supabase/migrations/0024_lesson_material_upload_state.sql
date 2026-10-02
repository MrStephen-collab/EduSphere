-- EduSphere — lesson materials: record video processing state
--
-- 0014 added the video columns but no notion of "uploaded, not playable yet".
-- The consequence was that a teacher could not tell the two states apart:
-- a finished video and a video still encoding looked identical in every query,
-- so a course page could not honestly say whether it had a video to show, and a
-- teacher could not tell a slow upload from a broken one.
--
-- Three columns, all nullable so this stays backwards compatible with the rows
-- that already exist:
--
--   upload_state     'waiting' -> 'processing' -> 'ready' | 'errored'
--   provider_upload_id  the video host's direct-upload id, needed to poll the
--                       upload when no webhook is configured
--   upload_error     the host's own message when the upload or asset fails
--
-- provider_upload_id is intentionally stored rather than kept in memory: the
-- browser hands the bytes to the video host directly, so the server has to
-- rediscover the upload from a later request.
--
-- Existing video rows are backfilled to 'ready' because each one has a
-- playback id, which is only ever written after the asset finished encoding.
-- Non-video rows get 'uploaded', which is what the bucket-backed categories
-- reach immediately.

alter table public.lesson_materials
  add column if not exists upload_state text,
  add column if not exists provider_upload_id text,
  add column if not exists upload_error text;

comment on column public.lesson_materials.upload_state is
  'Video processing state: waiting, processing, ready or errored. Null for non-video materials.';
comment on column public.lesson_materials.provider_upload_id is
  'Direct-upload id issued by the video host, used to poll for readiness when no webhook is configured.';
comment on column public.lesson_materials.upload_error is
  'Message from the video host when an upload or asset fails.';

update public.lesson_materials
set upload_state = case
      when file_type = 'video' and provider_playback_id is not null then 'ready'
      when file_type = 'video' then 'processing'
      else 'uploaded'
    end
where upload_state is null;

do $$
begin
  -- A row is only playable when it has a playback id, and only then is
  -- 'ready' honest. Enforcing it here rather than trusting each call site means
  -- the course listing can filter on upload_state alone.
  if not exists (
    select 1 from pg_constraint where conname = 'lesson_materials_ready_needs_playback'
  ) then
    alter table public.lesson_materials
      add constraint lesson_materials_ready_needs_playback
      check (
        upload_state is distinct from 'ready'
        or (file_type = 'video' and provider_playback_id is not null)
      );
  end if;
end
$$;

create index if not exists lesson_materials_upload_state_idx
  on public.lesson_materials (upload_state)
  where deleted_at is null;
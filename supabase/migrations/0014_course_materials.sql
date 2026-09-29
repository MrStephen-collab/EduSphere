-- =============================================================================
-- EduSphere — 0014: teacher course materials
-- Private file storage (docs, PDF, audio) + externally hosted video with
-- signed, per-student playback and forensic watermarking.
--
-- Download model:
--   * bucket "course-materials" is PRIVATE. Nothing is ever served by a
--     public URL; every read goes through a short-lived signed URL minted
--     server-side after an authorisation check.
--   * video lives outside the bucket (Mux-style provider) and plays only
--     through a signed token bound to one student + one lesson, so the
--     provider's logs attribute every playback session to a named user.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Private bucket
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials',
  'course-materials',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    'audio/x-m4a'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- storage_school_id(object_name)
--
-- Objects are namespaced "<school_id>/<lesson_id>/<file>", so the school a
-- request touches is derived from the path rather than trusted from the
-- client. Returns NULL for anything that is not a uuid-prefixed path, which
-- makes the RLS predicates below deny cleanly instead of raising a cast error.
-- -----------------------------------------------------------------------------
create or replace function public.storage_school_id(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then split_part(object_name, '/', 1)::uuid
    else null
  end;
$$;

-- -----------------------------------------------------------------------------
-- storage.objects policies
--
-- Deliberately NO select policy for the general read path. Direct reads are
-- never permitted; the app mints signed URLs with the service role after
-- checking permissions itself. Teachers may manage objects in their own
-- school's folder.
-- -----------------------------------------------------------------------------
create policy "p_storage_course_materials_insert_teacher"
  on storage.objects for insert
  with check (
    bucket_id = 'course-materials'
    and public.is_teacher(public.storage_school_id(name))
  );

create policy "p_storage_course_materials_update_teacher"
  on storage.objects for update
  using (
    bucket_id = 'course-materials'
    and public.is_teacher(public.storage_school_id(name))
  )
  with check (
    bucket_id = 'course-materials'
    and public.is_teacher(public.storage_school_id(name))
  );

create policy "p_storage_course_materials_delete_teacher"
  on storage.objects for delete
  using (
    bucket_id = 'course-materials'
    and public.is_teacher(public.storage_school_id(name))
  );

-- School admins may also clean up.
create policy "p_storage_course_materials_insert_admin"
  on storage.objects for insert
  with check (
    bucket_id = 'course-materials'
    and public.is_school_admin(public.storage_school_id(name))
  );

create policy "p_storage_course_materials_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'course-materials'
    and public.is_school_admin(public.storage_school_id(name))
  );

-- Students uploading assignment work go through a different bucket; nothing
-- here grants them write access to course content.

-- -----------------------------------------------------------------------------
-- lesson_materials: real uploads
-- -----------------------------------------------------------------------------
alter table public.lesson_materials
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists download_restricted boolean not null default false,
  add column if not exists provider text,
  add column if not exists provider_asset_id text,
  add column if not exists provider_playback_id text,
  add column if not exists duration_seconds integer;

comment on column public.lesson_materials.storage_path is
  'Object path inside the private course-materials bucket. Never exposed to clients; reads use short-lived signed URLs.';
comment on column public.lesson_materials.download_restricted is
  'When true the material is streamed through an expiring signed URL and rendered in a player without native save controls. Applies to audio and externally hosted video.';
comment on column public.lesson_materials.provider is
  'External host for video ("mux"). Null for files held in the private bucket and for plain links.';

create index if not exists lesson_materials_storage_path_idx
  on public.lesson_materials (storage_path)
  where storage_path is not null;

create unique index if not exists lesson_materials_provider_asset_uniq
  on public.lesson_materials (school_id, provider, provider_asset_id)
  where provider_asset_id is not null;

-- -----------------------------------------------------------------------------
-- video_access_log: forensic trail
--
-- One row per playback grant. This is what makes a leaked recording
-- attributable: the provider's own logs can be joined back to a user through
-- the grant's subject, and this table records who asked, when, and from
-- where, before playback even starts.
--
-- `token_subject` is whatever the issued credential authorises on, never the
-- viewer's user id: Mux matches a signed request's `sub` claim against the
-- asset in the stream URL, so `sub` is the playback id, and Supabase Storage
-- authorises on the path inside the signed URL. Writing a user id here would
-- record a subject no credential carries and break the join it exists for.
-- Attribution to a person runs playback_id (or asset_id) -> viewer_id.
-- -----------------------------------------------------------------------------
create table if not exists public.video_access_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  material_id uuid references public.lesson_materials (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewer_role text not null,
  provider text not null,
  asset_id text,
  playback_id text,
  token_subject text not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index video_access_log_viewer_idx
  on public.video_access_log (viewer_id, created_at desc);
create index video_access_log_material_idx
  on public.video_access_log (material_id, created_at desc);
create index video_access_log_school_idx
  on public.video_access_log (school_id, created_at desc);

alter table public.video_access_log enable row level security;

-- Students see their own playback history (their watermark, their trail).
create policy "video_access_log_select_own"
  on public.video_access_log for select
  using (viewer_id = auth.uid() or public.is_super_admin());

-- School admins may review playback for their school, e.g. to investigate a leak.
create policy "video_access_log_select_admin"
  on public.video_access_log for select
  using (public.is_super_admin() or public.is_school_admin(school_id));

-- Inserts happen through the service role only: the app logs after it has
-- already authorised the viewer. No client-facing insert policy.

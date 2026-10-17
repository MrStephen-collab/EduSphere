-- =============================================================================
-- EduSphere — 0032: school assets (logos)
--
-- Schools need a logo, and it has to be visible everywhere the school appears:
-- its public website, admission letters, report cards and the console. Unlike
-- course material, a logo is not confidential, so this is a PUBLIC bucket read
-- straight off the CDN with no signed URL.
--
--   * object path is "<school_id>/logo-<timestamp>.<ext>", so the school an
--     object belongs to is derived from its path (public.storage_school_id),
--     never trusted from the client;
--   * only a school owner or admin may write inside their own school's folder;
--   * uploads are capped at 2 MB and limited to raster image types — SVG is
--     deliberately excluded because a public bucket would then serve active
--     content on the school's own domain.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-assets',
  'school-assets',
  true,
  2097152,
  array[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read a school logo (that is the point of a public bucket).
drop policy if exists "p_storage_school_assets_select" on storage.objects;
create policy "p_storage_school_assets_select"
  on storage.objects for select
  using (bucket_id = 'school-assets');

-- Only the school's own admins may add, replace or remove its logo.
drop policy if exists "p_storage_school_assets_insert_admin" on storage.objects;
create policy "p_storage_school_assets_insert_admin"
  on storage.objects for insert
  with check (
    bucket_id = 'school-assets'
    and public.is_school_admin(public.storage_school_id(name))
  );

drop policy if exists "p_storage_school_assets_update_admin" on storage.objects;
create policy "p_storage_school_assets_update_admin"
  on storage.objects for update
  using (
    bucket_id = 'school-assets'
    and public.is_school_admin(public.storage_school_id(name))
  )
  with check (
    bucket_id = 'school-assets'
    and public.is_school_admin(public.storage_school_id(name))
  );

drop policy if exists "p_storage_school_assets_delete_admin" on storage.objects;
create policy "p_storage_school_assets_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'school-assets'
    and public.is_school_admin(public.storage_school_id(name))
  );

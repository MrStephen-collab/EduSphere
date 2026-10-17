-- =============================================================================
-- EduSphere — Phase 2: per-user data preferences (spec section 50)
--
-- Data Saver / Balanced / High Quality, plus a video quality override.
-- The school's existing school_settings.low_data_mode flag stays the default
-- for a learner who has never chosen; an explicit choice here wins over both
-- that flag and the device's own "save data" request, because it was made
-- knowingly inside the product. The device flag only shapes the default.
-- =============================================================================

create type public.data_mode as enum ('saver', 'balanced', 'high');
create type public.video_quality as enum ('auto', '360p', '480p', '720p');

create table public.user_data_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  data_mode public.data_mode not null default 'balanced',
  video_quality public.video_quality not null default 'auto',
  updated_at timestamptz not null default now()
);

alter table public.user_data_preferences enable row level security;

-- A preference is personal: the owner reads and writes it, a platform super
-- admin can see it for support, nobody else gets a row.
create policy "user_data_preferences_select_own"
  on public.user_data_preferences for select
  using (user_id = auth.uid() or public.is_super_admin());

create policy "user_data_preferences_insert_own"
  on public.user_data_preferences for insert
  with check (user_id = auth.uid());

create policy "user_data_preferences_update_own"
  on public.user_data_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_data_preferences_delete_own"
  on public.user_data_preferences for delete
  using (user_id = auth.uid());

create trigger user_data_preferences_set_updated_at
  before update on public.user_data_preferences
  for each row execute function public.set_updated_at();

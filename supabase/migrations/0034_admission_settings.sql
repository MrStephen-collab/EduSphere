-- =============================================================================
-- EduSphere — Admission settings
--
-- One row per school controlling the public admissions link:
--
--   * enabled        — the link is off by default. Until an admin turns it on,
--                      the public form is hidden and the API refuses
--                      applications. Today every active school silently
--                      exposes an open form, which is wrong for a school that
--                      is not recruiting.
--   * opens_at / closes_at — an optional application window. Null means
--                      "no bound on that side".
--   * intake_label   — what the intake is called ("2026/2027 Academic Session").
--   * intro_message  — a short paragraph shown above the public form.
--   * application_fee_amount / currency / fee_note — the fee shown to
--                      applicants on the public page. Display-only for now:
--                      online collection is a follow-up, not part of this
--                      migration.
--
-- Access model mirrors 0028: school admins (and a super admin) can read the
-- row through RLS; writes go through trusted server code via the service role
-- (there is deliberately no INSERT/UPDATE policy -- a leaked anon key must not
-- be able to open a school's admission window or change its fee).
-- =============================================================================

create table if not exists public.admission_settings (
  school_id uuid primary key references public.schools (id) on delete cascade,
  enabled boolean not null default false,
  -- timestamptz so the window is compared against "now" correctly regardless
  -- of the school's timezone.
  opens_at timestamptz,
  closes_at timestamptz,
  intake_label text,
  intro_message text,
  application_fee_amount numeric(12, 2)
    check (application_fee_amount is null or application_fee_amount >= 0),
  -- ISO 4217 code. Default NGN; the form offers a small curated list.
  application_fee_currency text not null default 'NGN',
  fee_note text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A window that closes before it opens is a typo, not an intent.
  constraint admission_settings_window_ck
    check (opens_at is null or closes_at is null or opens_at < closes_at)
);

comment on column public.admission_settings.enabled is
  'Whether the public admissions link is on. Off by default: a school opts in.';

alter table public.admission_settings enable row level security;

drop policy if exists p_admission_settings_select_admin on public.admission_settings;
create policy "p_admission_settings_select_admin"
  on public.admission_settings for select
  using (public.is_super_admin() or public.is_school_admin(school_id));

-- No INSERT/UPDATE/DELETE policy: the settings form writes through the service
-- role in src/services/admissions.ts after requireSchoolAdmin() has checked
-- the caller. RLS read access is all the anon/authenticated roles get.

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists admission_settings_set_updated_at on public.admission_settings;
create trigger admission_settings_set_updated_at
  before update on public.admission_settings
  for each row
  execute function public.set_updated_at();

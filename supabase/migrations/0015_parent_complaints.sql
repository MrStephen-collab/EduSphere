-- =============================================================================
-- EduSphere — Parent complaints & school feedback
--
-- A parent (or a admin on their own behalf) raises an issue with the school and
-- the admin receives it in an inbox. A complaint is a thread: one row in
-- `complaints` holds the subject and the working status, and every message
-- under it lives in `complaint_messages`.
--
-- The split matters for access control. If replies shared the thread's table,
-- a reply would carry its own author, and the rule "you may read what you
-- wrote" would hide the school's answer from the parent who asked the
-- question. Keeping messages in their own table lets one policy decide the
-- whole conversation: the raiser, the assignee and school admins see all of
-- it, and nobody else sees any of it.
--
--   * category — what the complaint is about, so an admin can triage.
--   * status   — open | in_progress | resolved, the admin's working state.
--   * The raiser is recorded as a user id, not a parent id, so the record
--     survives the parent row being removed and works for other roles.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.complaint_category as enum (
    'academics',
    'fees',
    'conduct',
    'facilities',
    'staff',
    'transport',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.complaint_status as enum ('open', 'in_progress', 'resolved');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  raised_by uuid not null references public.profiles (id) on delete cascade,
  -- denormalised for the inbox list; profiles is the authority if they diverge
  raised_by_name text not null default '',
  raised_by_role text not null default 'PARENT',
  category public.complaint_category not null default 'other',
  subject text not null,
  status public.complaint_status not null default 'open',
  assigned_to uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.complaint_messages (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null default '',
  is_from_school boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

-- the inbox: a school's threads, newest activity first
create index if not exists complaints_school_status_idx
  on public.complaints (school_id, status, created_at desc);

create index if not exists complaints_raised_by_idx
  on public.complaints (raised_by, created_at desc);

create index if not exists complaints_assigned_to_idx
  on public.complaints (assigned_to, created_at desc)
  where assigned_to is not null;

-- reading a conversation: its messages in order
create index if not exists complaint_messages_thread_idx
  on public.complaint_messages (complaint_id, created_at);

-- ---------------------------------------------------------------------------
-- Access rules
--
-- Shared by both tables so a thread is never half-visible: the raiser, the
-- assignee, and this school's admins. A teacher cannot read a complaint raised
-- about the school, and no parent can read a colleague's.
-- ---------------------------------------------------------------------------
create or replace function public.can_access_complaint(p_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.complaints c
    where c.id = p_complaint_id
      and (
        public.is_super_admin()
        or public.is_school_admin(c.school_id)
        or c.raised_by = auth.uid()
        or c.assigned_to = auth.uid()
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.complaints enable row level security;

create policy "complaints_select_thread_members"
  on public.complaints for select
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or raised_by = auth.uid()
    or assigned_to = auth.uid()
  );

-- A school member may open a thread, but only in their own name.
create policy "complaints_insert_own"
  on public.complaints for insert
  with check (
    public.is_super_admin()
    or (raised_by = auth.uid() and public.is_school_member(school_id))
  );

-- Only the school moves a thread's status, assignment or resolution. A parent
-- cannot mark their own complaint resolved or hand it to someone else.
create policy "complaints_update_school"
  on public.complaints for update
  using (public.is_super_admin() or public.is_school_admin(school_id))
  with check (public.is_super_admin() or public.is_school_admin(school_id));

-- A raiser may withdraw a thread while it is still open.
create policy "complaints_delete_own"
  on public.complaints for delete
  using (raised_by = auth.uid() and status = 'open');

alter table public.complaint_messages enable row level security;

-- Whole-thread visibility, not per-message: the raiser must see the school's
-- reply even though they did not write it.
create policy "complaint_messages_select_thread_members"
  on public.complaint_messages for select
  using (public.can_access_complaint(complaint_id));

-- A reply must be into a thread the author can access, and must not be signed
-- as coming from the school unless the author actually administers it --
-- otherwise a parent could post a message that reads as an official response.
--
-- `complaint_messages` deliberately carries no school_id of its own: thread
-- access is resolved through can_access_complaint, and a second copy of the
-- school id would be free to drift out of sync with the thread's school.
create policy "complaint_messages_insert_thread_members"
  on public.complaint_messages for insert
  with check (
    public.can_access_complaint(complaint_id)
    and (author_id = auth.uid() or public.is_super_admin())
    and (
      is_from_school is false
      or public.is_super_admin()
      or public.is_school_admin(
        (select c.school_id from public.complaints c where c.id = complaint_id)
      )
    )
  );

-- Messages are immutable once sent: a correction is a new message. No update
-- or delete policy, so the record of what was said cannot be rewritten.

-- ---------------------------------------------------------------------------
-- updated_at on the thread (status and assignment change after creation)
-- ---------------------------------------------------------------------------
drop trigger if exists complaints_set_updated_at on public.complaints;
create trigger complaints_set_updated_at
  before update on public.complaints
  for each row
  execute function public.set_updated_at();

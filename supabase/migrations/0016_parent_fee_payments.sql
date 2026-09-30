-- =============================================================================
-- EduSphere — Parent fee invoices & school payment approval
--
-- Schools charge per child, so the money trail has to hang off a student rather
-- than off the school the way `payments` (the SaaS subscription ledger) does. A
-- `fee_invoice` is what a school issues to one child for one term or one-off
-- item; a `fee_payment` is a single attempt to settle that invoice through
-- Paystack. The two are deliberately separate: an invoice can be paid across
-- several attempts, and an attempt can be rejected without touching the
-- invoice's history.
--
-- The approval model is the important decision here. A Paystack webhook only
-- proves that money left the parent's account -- it does not prove the school
-- received and accepted it, which for offline-capable bank transfers is a real
-- possibility. So the webhook moves a payment to `submitted` and stops. Only a
-- school admin moving it to `approved` credits `amount_paid` and settles the
-- invoice. A parent therefore cannot mark themselves paid, and a forged or
-- abandoned checkout cannot mint money.
--
-- Access control follows the parent-portal pattern from 0010/0013/0015:
--
--   * A parent sees invoices for linked children and nothing else -- not their
--     own other children they are not linked to, not a colleague's child.
--   * A parent has no INSERT, UPDATE or DELETE policy on `fee_payments` at
--     all. Every write goes through the service layer, so the only way a payment
--     reaches `approved` is a bursar's click. A teacher cannot approve fees
--     either; `is_school_admin` excludes principals, matching the rest of the
--     school area.
--
-- `billing_key` exists so that "charge First Term to JSS 1" is idempotent. Bulk
-- generation derives a deterministic key and a unique index on it, so a bursar
-- who double-taps cannot bill a class twice. Hand-written invoices leave the
-- key null, which a unique index allows repeatedly, so one-off charges stay
-- possible.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.fee_invoice_status as enum (
    'unpaid', 'partially_paid', 'paid', 'waived', 'void'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fee_payment_status as enum (
    'pending', 'submitted', 'approved', 'rejected', 'failed'
  );
exception when duplicate_object then null; end $$;

-- Payment events get their own notification types rather than riding on
-- 'system', so a parent can see "Payment approved" rather than "Notification".
-- Added values are not usable until this migration commits; nothing below
-- inserts a notification, so that is not a problem here.
alter type public.notification_type add value if not exists 'fee_invoice_issued';
alter type public.notification_type add value if not exists 'fee_payment_submitted';
alter type public.notification_type add value if not exists 'fee_payment_approved';
alter type public.notification_type add value if not exists 'fee_payment_rejected';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.fee_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  term_id uuid references public.terms (id) on delete set null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  -- credited only by an admin approval; never by the payer
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  currency text not null default 'NGN',
  due_date date,
  status public.fee_invoice_status not null default 'unpaid',
  -- non-null for generated term fees, null for hand-written one-offs
  billing_key text,
  issued_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- the database will refuse an approval that over-credits an invoice
  constraint fee_invoices_amount_paid_within_amount check (amount_paid <= amount)
);

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  invoice_id uuid not null references public.fee_invoices (id) on delete cascade,
  -- who initiated; kept separate from payer_user_id so the link survives a
  -- parents row being rebuilt
  parent_id uuid not null references public.parents (id) on delete cascade,
  payer_user_id uuid references public.profiles (id) on delete set null,
  provider text not null default 'paystack',
  provider_reference text,
  amount numeric(12,2) not null check (amount > 0),
  status public.fee_payment_status not null default 'pending',
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- the bursar's queue: a school's submitted payments, newest first
create index if not exists fee_payments_school_status_idx
  on public.fee_payments (school_id, status, created_at desc);

-- one invoice's settlement history in order
create index if not exists fee_payments_invoice_idx
  on public.fee_payments (invoice_id, created_at desc);

-- Idempotent bulk generation. Deliberately NOT a partial index: ON CONFLICT
-- cannot infer a partial index, and the upsert that makes a repeated "charge
-- First Term to JSS 1" a no-op depends on inferring this one. Postgres treats
-- NULLs as distinct in a unique index, so the many hand-written invoices with a
-- null billing_key are unaffected.
create unique index if not exists fee_invoices_billing_key_idx
  on public.fee_invoices (school_id, billing_key);

-- a provider reference can only ever be attached to one payment
create unique index if not exists fee_payments_provider_reference_idx
  on public.fee_payments (provider, provider_reference);

-- the arrears report
create index if not exists fee_invoices_school_status_idx
  on public.fee_invoices (school_id, status, due_date);

create index if not exists fee_invoices_student_idx
  on public.fee_invoices (student_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Access rules
--
-- Shared by both tables so a payment is never visible without the invoice it
-- belongs to. Mirrors can_access_complaint: resolve the invoice, then ask who is
-- allowed to see it.
--
-- The two branches are deliberately *not* one function. The admin branch needs
-- only the row's own school_id, so it is written directly into the SELECT policy
-- below; routing it through a helper that reads fee_invoices back would make the
-- policy unable to see the row it is being asked about.
-- ---------------------------------------------------------------------------

-- A parent may see a child they are explicitly linked to, and nothing else.
-- Reads only parents and the link table, never fee_invoices, so it is safe to
-- call from a policy on fee_invoices itself.
create or replace function public.is_parent_of_student(p_student_id uuid, p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parents p
    join public.parent_student_relationships psr
      on psr.parent_id = p.id
    where p.user_id = auth.uid()
      and psr.student_id = p_student_id
      and psr.school_id = p_school_id
  );
$$;

create or replace function public.can_access_fee_invoice(p_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fee_invoices i
    where i.id = p_invoice_id
      and (
        public.is_super_admin()
        or public.is_school_admin(i.school_id)
        or public.is_parent_of_student(i.student_id, i.school_id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.fee_invoices enable row level security;
alter table public.fee_payments enable row level security;

-- The admin branch is resolved from this row's own columns rather than through
-- can_access_fee_invoice, and that is not a style choice. A policy that reads
-- the table it guards is evaluated on the statement's snapshot, so during
-- `INSERT ... RETURNING` the helper cannot see the row being returned and the
-- insert is rejected with "new row violates row-level security policy" even
-- though the same bursar can read the row a moment later. Keeping the admin test
-- on school_id means the policy only ever looks at columns of the row in hand.
drop policy if exists p_fee_invoices_select_allowed on public.fee_invoices;
create policy "p_fee_invoices_select_allowed"
  on public.fee_invoices for select
  using (
    public.is_super_admin()
    or public.is_school_admin(school_id)
    or public.is_parent_of_student(student_id, school_id)
  );

-- Only the school issues what it is owed. A parent cannot write to an invoice at
-- all, which is what stops a self-declared "paid".
drop policy if exists p_fee_invoices_insert_school on public.fee_invoices;
create policy "p_fee_invoices_insert_school"
  on public.fee_invoices for insert
  with check (public.is_super_admin() or public.is_school_admin(school_id));

drop policy if exists p_fee_invoices_update_school on public.fee_invoices;
create policy "p_fee_invoices_update_school"
  on public.fee_invoices for update
  using (public.is_super_admin() or public.is_school_admin(school_id))
  with check (public.is_super_admin() or public.is_school_admin(school_id));

drop policy if exists p_fee_invoices_delete_school on public.fee_invoices;
create policy "p_fee_invoices_delete_school"
  on public.fee_invoices for delete
  using (public.is_super_admin() or public.is_school_admin(school_id));

-- Visibility follows the invoice, so a payment can never be read by someone who
-- cannot read the invoice it settles. Unlike the policy above this one *must*
-- resolve the invoice, which is always an already-committed row: fee_payments
-- has no INSERT policy, so there is no RETURNING row for it to fail to see.
drop policy if exists p_fee_payments_select_allowed on public.fee_payments;
create policy "p_fee_payments_select_allowed"
  on public.fee_payments for select
  using (public.can_access_fee_invoice(invoice_id));

-- No INSERT policy. Payments are created by the service layer, which knows the
-- outstanding balance; a client cannot invent a payment row, and without one
-- there is nothing for an admin to approve.
--
-- UPDATE is the review gate. Only a school admin can move a payment to
-- approved or rejected, so the money path requires a human.
drop policy if exists p_fee_payments_update_school on public.fee_payments;
create policy "p_fee_payments_update_school"
  on public.fee_payments for update
  using (public.is_super_admin() or public.is_school_admin(school_id))
  with check (public.is_super_admin() or public.is_school_admin(school_id));

-- No DELETE policy: a payment attempt is a financial record and is never
-- removed, only rejected or superseded.

-- ---------------------------------------------------------------------------
-- Money table exposure fix
--
-- 0002 generated these policies in a loop over a list of "generic
-- school-scoped" tables, including `payments` and `subscriptions`. That loop
-- granted SELECT to `is_school_member(school_id)`, which is true for *any*
-- user_roles row in the school -- so every student and every parent in a school
-- could read that school's entire subscription payment ledger, including
-- amounts and Paystack references.
--
-- Both tables are read through the request-scoped client in exactly two places,
-- getSchoolBilling and confirmSchoolPayment, and both of those pages are behind
-- requireSchoolAdmin(); every other read uses the service-role client, which
-- bypasses RLS entirely. Narrowing the policy to admins therefore closes the
-- hole without changing any behaviour that worked. The write policies already
-- required is_school_admin and are left alone.
-- ---------------------------------------------------------------------------
drop policy if exists p_payments_select on public.payments;
create policy "p_payments_select"
  on public.payments for select
  using (public.is_super_admin() or public.is_school_admin(school_id));

drop policy if exists p_subscriptions_select on public.subscriptions;
create policy "p_subscriptions_select"
  on public.subscriptions for select
  using (public.is_super_admin() or public.is_school_admin(school_id));

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists fee_invoices_set_updated_at on public.fee_invoices;
create trigger fee_invoices_set_updated_at
  before update on public.fee_invoices
  for each row
  execute function public.set_updated_at();

drop trigger if exists fee_payments_set_updated_at on public.fee_payments;
create trigger fee_payments_set_updated_at
  before update on public.fee_payments
  for each row
  execute function public.set_updated_at();

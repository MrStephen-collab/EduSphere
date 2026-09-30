-- =============================================================================
-- EduSphere — Record what an approval actually credited
--
-- 0016 stores two different amounts on a payment and they are not the same
-- number. `amount` is what the parent tendered, as confirmed by Paystack.
-- `credited_amount` is what a bursar's approval actually moved onto the
-- invoice, which applyApproval clamps to the outstanding balance.
--
-- Those differ whenever a payment is larger than the amount owed -- a parent
-- overpaying, a part-payment settled, a duplicate. 0016 kept the second figure
-- only in the audit log's metadata, which is the wrong place to read it from:
-- audit_logs is an append-only trail for investigation, not a ledger the app
-- queries. Without it the product cannot state, truthfully:
--
--   * how much a given receipt was for, when the parent paid more than they
--     owed and only the outstanding balance was credited;
--   * a statement of account that reconciles, since summing tendered amounts
--     overstates every credit and drives the running balance below what is
--     actually owed.
--
-- Nullable on purpose: only an approval sets it. A pending, submitted,
-- rejected or failed payment has credited nothing, and null says that honestly
-- where 0 would look like "we credited nothing against a settled invoice".
--
-- Backfilled from the audit trail for payments approved before this migration,
-- so a school that has already been approving payments gets correct receipts
-- rather than a column of nulls. The correlated subquery picks the most recent
-- approval of that payment, and only writes where one is found.
-- =============================================================================

alter table public.fee_payments
  add column if not exists credited_amount numeric(12,2);

comment on column public.fee_payments.credited_amount is
  'Amount actually credited to the invoice by an approval. Null until a school admin approves; may be less than amount when a payment exceeded the balance owed.';

-- Only a school admin moves a payment to approved, so the same predicate that
-- guards the status is the right guard for the amount that approval credits.
-- Without this, any principal-side write path could credit a figure that does
-- not match what the invoice was actually advanced by.
alter table public.fee_payments
  drop constraint if exists fee_payments_credited_requires_approved;

alter table public.fee_payments
  add constraint fee_payments_credited_requires_approved
  check (credited_amount is null or status = 'approved');

-- A credit can never exceed what was tendered, and never exceed the invoice.
alter table public.fee_payments
  drop constraint if exists fee_payments_credited_within_amount;

alter table public.fee_payments
  add constraint fee_payments_credited_within_amount
  check (credited_amount is null or credited_amount <= amount);

-- The statement reads one child's approved payments in order, so give it an
-- index that does not have to sort the school's whole payment history.
create index if not exists fee_payments_invoice_approved_idx
  on public.fee_payments (invoice_id, created_at desc)
  where status = 'approved';

-- ---------------------------------------------------------------------------
-- Backfill
--
-- audit_logs rows for an approval carry the figures in metadata:
--   { invoice_id, attempted, credited, uncredited, invoice_status }
-- Written by reviewFeePayment in 0016 and never updated afterwards, so the
-- latest row per payment is the one that counts.
--
-- The status and amount filters are not cosmetic: this statement runs *after*
-- the two check constraints above, so a row that fails either of them aborts
-- the entire migration rather than being skipped. Filtering here is what makes
-- the backfill safe on a database that has real history in it.
-- ---------------------------------------------------------------------------
update public.fee_payments p
set credited_amount = a.credited
from (
  select distinct on (entity_id) entity_id, (metadata->>'credited')::numeric as credited
  from public.audit_logs
  where entity_type = 'fee_payments'
    and action = 'fee_payment_approved'
    and entity_id is not null
    and metadata ? 'credited'
  order by entity_id, created_at desc
) a
where p.id = a.entity_id
  and p.credited_amount is null
  and p.status = 'approved'
  and a.credited is not null
  and a.credited >= 0
  and a.credited <= p.amount;

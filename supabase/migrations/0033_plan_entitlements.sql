-- =============================================================================
-- EduSphere — 0033: plan entitlements (money-table hardening + expiry sweep)
--
-- Plans used to be decorative: the subscription rows they lived behind could be
-- written by any school admin from their own browser, and nothing ever moved a
-- finished subscription out of "active". Both are fixed here.
--
--   * subscriptions/payments become write-for-platform-only. Every write in the
--     app already goes through the service-role client (startCheckout,
--     confirmPaystackPayment, platformSetSchoolPlan), which bypasses RLS, so
--     removing the school-admin write policies changes no working code path —
--     it removes the one where a school could upgrade itself by posting a row.
--     Reads stay as 0016 left them: school admins can see their own ledger.
--
--   * expire_due_subscriptions() flips an ended period to 'expired'. It is a
--     plain text column (no enum), so no type migration is needed; the app also
--     flips rows lazily on first read after expiry, and this function exists for
--     deployments that want a scheduled sweep (pg_cron or an external job).
--
-- No CHECK constraint is added to status: existing rows in older deployments may
-- hold values the app no longer produces, and a constraint would fail to apply.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Writes: platform only. Select policies from 0016 are left untouched.
-- ---------------------------------------------------------------------------
drop policy if exists "p_subscriptions_insert" on public.subscriptions;
drop policy if exists "p_subscriptions_update" on public.subscriptions;
drop policy if exists "p_subscriptions_delete" on public.subscriptions;

create policy "p_subscriptions_insert"
  on public.subscriptions for insert
  with check (public.is_super_admin());

create policy "p_subscriptions_update"
  on public.subscriptions for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "p_subscriptions_delete"
  on public.subscriptions for delete
  using (public.is_super_admin());

drop policy if exists "p_payments_insert" on public.payments;
drop policy if exists "p_payments_update" on public.payments;
drop policy if exists "p_payments_delete" on public.payments;

create policy "p_payments_insert"
  on public.payments for insert
  with check (public.is_super_admin());

create policy "p_payments_update"
  on public.payments for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "p_payments_delete"
  on public.payments for delete
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Expiry sweep
-- ---------------------------------------------------------------------------
create index if not exists subscriptions_status_period_end_idx
  on public.subscriptions (status, current_period_end)
  where current_period_end is not null;

create or replace function public.expire_due_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  flipped integer;
begin
  update public.subscriptions
     set status = 'expired'
   where status in ('active', 'trialing')
     and current_period_end is not null
     and current_period_end < now();

  get diagnostics flipped = row_count;
  return flipped;
end;
$$;

-- Service role only: nobody with the anon or authenticated key can run the sweep.
revoke all on function public.expire_due_subscriptions() from public, anon, authenticated;
grant execute on function public.expire_due_subscriptions() to service_role;

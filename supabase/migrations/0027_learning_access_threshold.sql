-- 0027: per-school fee gate on course materials.
--
-- A school can withhold a student's course materials until enough of the fees
-- have been paid. The threshold is a percentage of what the student has been
-- billed, stored on the school so it is one setting rather than a hardcoded
-- rule: a school that wants 100% before materials open and a school that wants
-- 40% are both a single column away from each other.
--
-- Default 0 means OFF, deliberately. A gate that starts closed would take
-- materials away from every existing school the moment this migration lands,
-- and nobody asked for that. Zero means "no threshold", and only an admin who
-- types a percentage gets a gate.
--
-- The column holds a whole percentage, not a fraction, because the form field
-- says "50" and a bursar should never have to work out that 0.5 was meant.
--
-- Who is not gated:
--
--   - A student who has never been billed. Zero invoiced is not a debt, and the
--     app-level rule treats it as allowed (see src/lib/fee-gate.ts).
--   - A student whose invoices were waived. computeInvoiceTotals already leaves
--     waived and void rows out of the billed figure, so a bursary is expressed
--     by waiving the invoice rather than by maintaining an exemption list that
--     could disagree with the money.
--
-- Enforcement is in the app, not here: the signed-URL and playback-token paths
-- both go through authorizeMaterialRead in src/services/material-storage.ts,
-- which is the single place that has to refuse. A database check constraint
-- cannot express "this student may not read these bytes" without a second copy
-- of the balance rule that would drift from this one.

alter table public.schools
  add column if not exists learning_access_threshold_pct integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'schools_learning_access_threshold_pct_range'
  ) then
    alter table public.schools
      add constraint schools_learning_access_threshold_pct_range
      check (learning_access_threshold_pct between 0 and 100);
  end if;
end $$;

comment on column public.schools.learning_access_threshold_pct is
  'Percentage of billed fees that must be paid before a student can open course materials. 0 (the default) disables the gate; a student with nothing billed is never gated.';
